"""Dónde pierden tiempo los buses de Bogotá: pipeline en Ray o secuencial (misma lógica, ver tm/nucleo.py).

Etapas, cada una medida por separado:
  1. etl          .pb.gz -> Parquet por (día, crc32(vehicle_id) % 64). Ray Data: un archivo no depende de otro.
  2. recorridos   por partición: emparejar cada bus con su ruta según su sentido de marcha, cortar en pasadas y
                  medir cuánto tarda en cada tramo de 500 m. Ray Core: una tarea por partición; las geometrías se
                  suben una vez al object store. La salida se escribe ya repartida por cubo de rutas.
  3. tramos       por cubo de rutas: velocidad p20/p50/p80 y retraso frente al flujo libre, por tramo y hora.

Uso:
  python pipeline.py --raw ../datos/raw --gtfs ../datos/gtfs/GTFS.zip --dias 2026-11-23 \
      --out /tmp/tm41 --modo ray --cpus 8 --tiempos ../resultados/tiempos.jsonl
"""

import argparse
import json
import os
import shutil
import time
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pyarrow as pa
import pyarrow.parquet as pq

from tm import confiable, nucleo


def archivos(raw: Path, dias: list[str]) -> list[str]:
    """Capturas que pueden tener reportes de esos días de servicio (ver nucleo.es_del_dia)."""
    sal = []
    for d in dias:
        d0 = date.fromisoformat(d)
        for dd in (d0, d0 + timedelta(days=1)):
            sal += [str(p.resolve()) for p in sorted((raw / f"{dd:%Y/%m/%d}").glob("positions_*.pb.gz"))
                    if nucleo.es_del_dia(str(p), d)]
    return sal


def particiones(out: Path, dias: list[str]):
    """[(entrada, salida)] de la etapa 2. Solo los días pedidos: una captura de las 23:59 trae reportes del día
    siguiente, que quedan incompletos."""
    return [(str(d), str(out / "recorridos")) for d in sorted((out / "posiciones").glob("dia=*/parte=*"))
            if d.parent.name.split("=", 1)[1] in dias]


def cubos(out: Path):
    """[(entradas, salida)] de la etapa 3: un cubo de rutas por tarea."""
    return [(sorted(str(f) for f in c.glob("*.parquet")), str(out / "tramos" / f"{c.name}.parquet"))
            for c in sorted((out / "recorridos").glob("cubo=*"))]


def cubos_confiabilidad(out: Path):
    """[(entradas, horario, salida)] de la etapa 4: el mismo cubo de rutas de los recorridos y del horario."""
    return [(es, str(out / "horario" / c), str(out / "confiabilidad" / f"{c}.parquet"))
            for es, c in ((sorted(str(f) for f in d.glob("*.parquet")), d.name) for d in sorted((out / "recorridos").glob("cubo=*")))]


def guardar_walkforward(out: Path, partes: list):
    (out / "walkforward.json").write_text(json.dumps(confiable.juntar_walkforward(partes), indent=1))


def correr_ray(rutas, gtfs, out: Path, dias, cpus: int, etapas):
    os.environ.setdefault("RAY_ENABLE_UV_RUN_RUNTIME_ENV", "0")  # no empaquetar el .venv como working_dir
    import ray
    import ray.data as rd

    ray.init(num_cpus=cpus, include_dashboard=False, log_to_driver=False,
             object_store_memory=int(os.environ.get("TM_OBJ_STORE", 2 * 1024**3)))
    rd.DataContext.get_current().enable_progress_bars = False
    t = {}
    if "etl" in etapas:
        t0 = time.perf_counter()
        (rd.read_binary_files(rutas, override_num_blocks=max(cpus * 4, 64))
           .map_batches(nucleo.parsear_lote, batch_size=8, batch_format="numpy")
           .write_parquet(str(out / "posiciones"), partition_cols=["dia", "parte"]))
        t["etl"] = time.perf_counter() - t0
    if "recorridos" in etapas:
        t0 = time.perf_counter()
        geos = ray.put(nucleo.cargar_geometrias(gtfs))
        tarea = ray.remote(num_cpus=1)(nucleo.particion)
        ray.get([tarea.remote(e, s, geos) for e, s in particiones(out, dias)])
        t["recorridos"] = time.perf_counter() - t0
    if "tramos" in etapas:
        t0 = time.perf_counter()
        tarea = ray.remote(num_cpus=1)(nucleo.cubo_tramos)
        ray.get([tarea.remote(es, s) for es, s in cubos(out)])
        t["tramos"] = time.perf_counter() - t0
    if "confiabilidad" in etapas:  # paradas y horario se preparan una vez; luego una tarea por cubo de rutas
        t0 = time.perf_counter()
        geos = nucleo.cargar_geometrias(gtfs)
        par = ray.put(confiable.paradas(gtfs, geos))
        sis = ray.put(nucleo.sistemas(gtfs))
        ray.get(ray.remote(num_cpus=1)(confiable.repartir_horario).remote(gtfs, str(out / "horario")))
        tarea = ray.remote(num_cpus=1)(confiable.cubo)
        guardar_walkforward(out, ray.get([tarea.remote(es, h, s, par, sis) for es, h, s in cubos_confiabilidad(out)]))
        t["confiabilidad"] = time.perf_counter() - t0
    ray.shutdown()
    return t


def correr_secuencial(rutas, gtfs, out: Path, dias, etapas):
    """El mismo trabajo, en el mismo orden, en un solo proceso: la línea base del speedup."""
    t = {}
    if "etl" in etapas:
        t0 = time.perf_counter()
        partes = [nucleo.parsear(Path(r).read_bytes()) for r in rutas]
        tabla = pa.table({k: np.concatenate([p[k] for p in partes]) for k in nucleo.COLUMNAS})
        pq.write_to_dataset(tabla, str(out / "posiciones"), partition_cols=["dia", "parte"])
        del partes, tabla  # sin esto la tabla del ETL (GB) se queda en memoria en las etapas siguientes
        t["etl"] = time.perf_counter() - t0
    if "recorridos" in etapas:
        t0 = time.perf_counter()
        geos = nucleo.cargar_geometrias(gtfs)
        for e, s in particiones(out, dias):
            nucleo.particion(e, s, geos)
        t["recorridos"] = time.perf_counter() - t0
    if "tramos" in etapas:
        t0 = time.perf_counter()
        for es, s in cubos(out):
            nucleo.cubo_tramos(es, s)
        t["tramos"] = time.perf_counter() - t0
    if "confiabilidad" in etapas:
        t0 = time.perf_counter()
        geos = nucleo.cargar_geometrias(gtfs)
        par, sis = confiable.paradas(gtfs, geos), nucleo.sistemas(gtfs)
        confiable.repartir_horario(gtfs, str(out / "horario"))
        guardar_walkforward(out, [confiable.cubo(es, h, s, par, sis) for es, h, s in cubos_confiabilidad(out)])
        t["confiabilidad"] = time.perf_counter() - t0
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", required=True)
    ap.add_argument("--gtfs", required=True)
    ap.add_argument("--dias", required=True, help="días de servicio separados por coma (AAAA-MM-DD)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--modo", choices=["ray", "secuencial"], default="ray")
    ap.add_argument("--cpus", type=int, default=os.cpu_count())
    ap.add_argument("--etapas", default="etl,recorridos,tramos,confiabilidad")
    ap.add_argument("--tiempos", help="agrega una línea JSON con los tiempos a este archivo")
    ap.add_argument("--etiqueta", default="")
    a = ap.parse_args()

    dias = a.dias.split(",")
    rutas = archivos(Path(a.raw), dias)
    out = Path(a.out).resolve()
    gtfs = str(Path(a.gtfs).resolve())
    etapas = a.etapas.split(",")
    for k, etapa in (("posiciones", "etl"), ("recorridos", "recorridos"), ("tramos", "tramos"), ("tramos_dia", "tramos"),
                     ("horario", "confiabilidad"), ("confiabilidad", "confiabilidad")):
        if etapa in etapas and (out / k).exists():
            shutil.rmtree(out / k)  # cada etapa reescribe su salida completa
    out.mkdir(parents=True, exist_ok=True)
    mb = sum(os.path.getsize(r) for r in rutas) / 1e6
    print(f"{a.modo} · {a.cpus} cpus · {len(rutas)} archivos · {mb:.0f} MB · etapas {etapas}", flush=True)

    t = correr_ray(rutas, gtfs, out, dias, a.cpus, etapas) if a.modo == "ray" else correr_secuencial(rutas, gtfs, out, dias, etapas)
    import pyarrow.dataset as pads
    filas = {k: pads.dataset(str(out / k), format="parquet").count_rows()
             for k in ("posiciones", "recorridos", "tramos", "confiabilidad") if (out / k).exists()}
    reg = {"etiqueta": a.etiqueta, "modo": a.modo, "cpus": a.cpus if a.modo == "ray" else 1, "archivos": len(rutas),
           "mb": round(mb, 1), "dias": a.dias, "tiempos": {k: round(v, 2) for k, v in t.items()}, "filas": filas,
           "nproc": os.cpu_count()}
    print(json.dumps(reg), flush=True)
    if a.tiempos:
        Path(a.tiempos).parent.mkdir(parents=True, exist_ok=True)
        with open(a.tiempos, "a") as f:
            f.write(json.dumps(reg) + "\n")


if __name__ == "__main__":
    main()
