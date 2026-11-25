"""Pipeline TransMilenio GTFS-RT, en Ray o secuencial (misma lógica, ver tm/nucleo.py).

Etapas, cada una medida por separado:
  1. etl          .pb.gz -> Parquet (paralelismo de datos: un archivo no depende de otro)
  2. trayectorias por partición (día, hash(vehicle_id) % 64): ordenar, deduplicar y map-matching contra
                  shapes.txt (kernel de CPU). El shuffle se hizo al escribir en la etapa 1; las geometrías
                  se suben una vez al object store (ray.put) y cada tarea recibe la referencia.
  3. headways     por partición: momentos en que cada bus cruza puntos de control cada 1 km de su ruta (sobre
                  la distancia del map-matching); luego, por día, intervalo entre buses consecutivos en cada punto.
                  No usa stop_id: el feed no lo actualizaba antes del 18 de noviembre.

Uso:
  python pipeline.py --raw ../datos/raw --gtfs ../datos/gtfs/GTFS.zip --dias 2026-11-12,2026-11-13 \
      --out /tmp/tm --modo ray --cpus 8 --tiempos ../resultados/tiempos.jsonl
"""

import argparse
import json
import os
import shutil
import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

from tm import nucleo


def archivos(raw: Path, dias: list[str]) -> list[str]:
    """Capturas de posiciones que pueden tener reportes de esos días de servicio (hora de Bogotá).
    Las carpetas están en UTC: el día de Bogotá D va de D 05:00 UTC a D+1 05:00 UTC."""
    sal = []
    for d in dias:
        d0 = date.fromisoformat(d)
        for dd in (d0, d0 + timedelta(days=1)):
            carpeta = raw / f"{dd:%Y/%m/%d}"
            for p in sorted(carpeta.glob("positions_*.pb.gz")):
                hhmm = p.name.split("T")[1][:4]
                if (dd == d0 and hhmm >= "0500") or (dd != d0 and hhmm < "0500"):
                    sal.append(str(p.resolve()))
    return sal


def particiones(out: Path):
    """[(entrada, salida)] de la etapa 2: un archivo de salida por cada carpeta dia=*/parte=*."""
    pares = []
    for d in sorted((out / "posiciones").glob("dia=*/parte=*")):
        pares.append((str(d), str(out / "trayectorias" / d.parent.name / f"{d.name}.parquet")))
    return pares


def particiones_cruces(out: Path):
    return [(str(f), str(out / "cruces" / f.parent.name / f.name)) for f in sorted((out / "trayectorias").glob("dia=*/*.parquet"))]


def por_dia(out: Path):
    dias = {}
    for f in sorted((out / "cruces").glob("dia=*/*.parquet")):
        dias.setdefault(f.parent.name, []).append(str(f))
    return [(fs, str(out / "headways" / f"{d}.parquet")) for d, fs in dias.items()]


# ------------------------------------------------------------------------------------------- Ray
def correr_ray(rutas, gtfs, out: Path, cpus: int, etapas):
    os.environ.setdefault("RAY_ENABLE_UV_RUN_RUNTIME_ENV", "0")  # no empaquetar el .venv como working_dir
    import ray
    import ray.data as rd

    ray.init(num_cpus=cpus, include_dashboard=False, log_to_driver=False,
             object_store_memory=int(os.environ.get("TM_OBJ_STORE", 2 * 1024**3)))
    ctx = rd.DataContext.get_current()
    ctx.enable_progress_bars = False
    t = {}

    if "etl" in etapas:  # Ray Data: paralelismo de datos, streaming de bloques
        t0 = time.perf_counter()
        (rd.read_binary_files(rutas, override_num_blocks=max(cpus * 4, 64))
           .map_batches(nucleo.parsear_lote, batch_size=8, batch_format="numpy")
           .write_parquet(str(out / "posiciones"), partition_cols=["dia", "parte"]))
        t["etl"] = time.perf_counter() - t0

    if "trayectorias" in etapas:  # Ray Core: una tarea por partición; geometrías en el object store
        t0 = time.perf_counter()
        geos_ref = ray.put(nucleo.cargar_geometrias(gtfs))
        tarea = ray.remote(num_cpus=1)(nucleo.particion_trayectorias)
        ray.get([tarea.remote(e, s, geos_ref) for e, s in particiones(out)])
        t["trayectorias"] = time.perf_counter() - t0

    if "headways" in etapas:
        t0 = time.perf_counter()
        cruzar = ray.remote(num_cpus=1)(nucleo.particion_cruces)
        ray.get([cruzar.remote(e, s) for e, s in particiones_cruces(out)])  # una tarea por partición
        tarea = ray.remote(num_cpus=1)(nucleo.dia_headways)
        ray.get([tarea.remote(fs, s) for fs, s in por_dia(out)])          # una tarea por día
        t["headways"] = time.perf_counter() - t0

    ray.shutdown()
    return t


# ------------------------------------------------------------------------------------- secuencial
def correr_secuencial(rutas, gtfs, out: Path, etapas):
    """El mismo trabajo, en el mismo orden, en un solo proceso."""
    t = {}
    if "etl" in etapas:
        t0 = time.perf_counter()
        partes = [nucleo.parsear(Path(r).read_bytes()) for r in rutas]
        tabla = pa.table({k: np.concatenate([p[k] for p in partes]) for k in nucleo.COLUMNAS})
        pq.write_to_dataset(tabla, str(out / "posiciones"), partition_cols=["dia", "parte"])
        t["etl"] = time.perf_counter() - t0
    if "trayectorias" in etapas:
        t0 = time.perf_counter()
        geos = nucleo.cargar_geometrias(gtfs)
        for e, s in particiones(out):
            nucleo.particion_trayectorias(e, s, geos)
        t["trayectorias"] = time.perf_counter() - t0
    if "headways" in etapas:
        t0 = time.perf_counter()
        for e, s in particiones_cruces(out):
            nucleo.particion_cruces(e, s)
        for fs, s in por_dia(out):
            nucleo.dia_headways(fs, s)
        t["headways"] = time.perf_counter() - t0
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--gtfs", required=True)
    ap.add_argument("--dias", required=True, help="días de servicio separados por coma (AAAA-MM-DD)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--modo", choices=["ray", "secuencial"], default="ray")
    ap.add_argument("--cpus", type=int, default=os.cpu_count())
    ap.add_argument("--etapas", default="etl,trayectorias,headways")
    ap.add_argument("--max-archivos", type=int, default=0, help="para pruebas rápidas")
    ap.add_argument("--tiempos", help="agrega una línea JSON con los tiempos a este archivo")
    ap.add_argument("--etiqueta", default="")
    a = ap.parse_args()

    rutas = archivos(Path(a.raw), a.dias.split(","))
    if a.max_archivos:
        rutas = rutas[: a.max_archivos]
    out = Path(a.out).resolve()
    gtfs = str(Path(a.gtfs).resolve())
    etapas = a.etapas.split(",")
    if "etl" in etapas and out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True, exist_ok=True)
    mb = sum(os.path.getsize(r) for r in rutas) / 1e6
    print(f"{a.modo} · {a.cpus} cpus · {len(rutas)} archivos · {mb:.0f} MB · etapas {etapas}", flush=True)

    t = correr_ray(rutas, gtfs, out, a.cpus, etapas) if a.modo == "ray" else correr_secuencial(rutas, gtfs, out, etapas)
    import pyarrow.dataset as pads
    filas = {k: pads.dataset(str(out / k), format="parquet").count_rows()
             for k in ("posiciones", "trayectorias", "cruces", "headways") if (out / k).exists()}
    reg = {"etiqueta": a.etiqueta, "modo": a.modo, "cpus": a.cpus if a.modo == "ray" else 1, "archivos": len(rutas),
           "mb": round(mb, 1), "dias": a.dias, "tiempos": {k: round(v, 2) for k, v in t.items()}, "filas": filas,
           "nproc": os.cpu_count()}
    print(json.dumps(reg), flush=True)
    if a.tiempos:
        with open(a.tiempos, "a") as f:
            f.write(json.dumps(reg) + "\n")


if __name__ == "__main__":
    main()
