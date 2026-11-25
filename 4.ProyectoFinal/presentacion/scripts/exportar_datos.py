"""Exporta src/datos.json para la presentación a partir de capturas reales del archivo GTFS-RT.

Entradas (ver ../datos/):
  datos/raw/AAAA/MM/DD/positions_*.pb.gz   muestra bajada con datos/bajar.sh (lista en datos/muestra.txt)
  datos/gtfs/GTFS.zip                      GTFS estático de https://gtfs.transmilenio.gov.co
  datos/arbol.json                         listado del repo de capturas (se baja de la API de GitHub si falta)
  resultados/benchmark.json                (opcional) tiempos medidos del pipeline en Ray

Uso, desde 4.ProyectoFinal/:
  uv run --with gtfs-realtime-bindings --with pandas python presentacion/scripts/exportar_datos.py
"""

import csv
import gzip
import io
import json
import re
import urllib.request
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from google.transit import gtfs_realtime_pb2

RAIZ = Path(__file__).resolve().parents[2]  # 4.ProyectoFinal
DATOS = RAIZ / "datos"
SALIDA = RAIZ / "presentacion" / "src" / "datos.json"
BOG = timezone(timedelta(hours=-5))
REPO = "Fozzy3/parallel-computing-final"
FRESCO = 300  # s: un reporte con más de 5 min de antigüedad no cuenta como bus en servicio

# Ventana del replay y foto: martes 17 de noviembre de 2026, pico de la mañana (hora de Bogotá).
REPLAY_INI = datetime(2026, 11, 17, 6, 15, tzinfo=BOG)
REPLAY_FIN = datetime(2026, 11, 17, 7, 45, tzinfo=BOG)
FOTO = datetime(2026, 11, 17, 7, 0, tzinfo=BOG)
MAX_BUSES_REPLAY = 1600
PASO_REPLAY = 60  # s entre puntos de una trayectoria en el replay


def hora_archivo(p: Path) -> datetime:
    s = re.search(r"_(\d{8}T\d{6})Z", p.name).group(1)
    return datetime.strptime(s, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)


def leer(p: Path):
    f = gtfs_realtime_pb2.FeedMessage()
    f.ParseFromString(gzip.open(p).read())
    return f


def arbol():
    ruta = DATOS / "arbol.json"
    if not ruta.exists():
        url = f"https://api.github.com/repos/{REPO}/git/trees/main?recursive=1"
        with urllib.request.urlopen(url, timeout=60) as r:
            ruta.write_bytes(r.read())
    return [t for t in json.loads(ruta.read_text())["tree"] if t["type"] == "blob"]


def resumen_archivo():
    blobs = [t for t in arbol() if t["path"].endswith(".pb.gz")]
    por_dia = defaultdict(lambda: {"pos": 0, "alertas": 0, "mb": 0.0})
    for t in blobs:
        d = "-".join(t["path"].split("/")[1:4])
        k = "pos" if "/positions_" in t["path"] else "alertas"
        por_dia[d][k] += 1
        por_dia[d]["mb"] += t["size"] / 1e6
    return {
        "archivos": len(blobs),
        "posiciones": sum(v["pos"] for v in por_dia.values()),
        "alertas": sum(v["alertas"] for v in por_dia.values()),
        "gb": round(sum(t["size"] for t in blobs) / 1e9, 2),
        "dias": len(por_dia),
        "por_dia": [{"dia": d, **{k: round(x, 1) if k == "mb" else x for k, x in v.items()}} for d, v in sorted(por_dia.items())],
    }


def gtfs():
    z = zipfile.ZipFile(DATOS / "gtfs" / "GTFS.zip")
    rd = lambda n, **kw: pd.read_csv(io.BytesIO(z.read(n)), dtype=str, **kw)
    rutas = rd("routes.txt")
    viajes = rd("trips.txt", usecols=["route_id", "shape_id", "trip_id"])
    formas = rd("shapes.txt")
    return rutas, viajes, formas


def troncales(rutas, viajes, formas):
    """Una geometría por ruta troncal (agency 1), simplificada, para el mapa de fondo."""
    tr = rutas[rutas.agency_id == "1"]
    shp = viajes[viajes.route_id.isin(tr.route_id)].groupby("route_id").shape_id.agg(lambda s: s.mode().iloc[0])
    formas = formas[formas.shape_id.isin(set(shp))].copy()
    formas["seq"] = formas.shape_pt_sequence.astype(int)
    formas = formas.sort_values(["shape_id", "seq"])
    lineas, vistos = [], set()
    for rid, sid in shp.items():
        g = formas[formas.shape_id == sid]
        pts = list(zip(g.shape_pt_lon.astype(float), g.shape_pt_lat.astype(float)))
        if len(pts) < 2:
            continue
        # Reduce: un punto cada ~60 m aprox. (0.0006°), conserva los extremos.
        red = [pts[0]]
        for p in pts[1:-1]:
            if abs(p[0] - red[-1][0]) + abs(p[1] - red[-1][1]) > 0.0006:
                red.append(p)
        red.append(pts[-1])
        clave = tuple(round(c, 3) for c in red[0] + red[-1])
        if clave in vistos:
            continue
        vistos.add(clave)
        fila = tr[tr.route_id == rid].iloc[0]
        lineas.append({"c": "#" + fila.route_color, "n": fila.route_short_name, "p": [[round(x, 5), round(y, 5)] for x, y in red]})
    return lineas


def resumir_benchmark(tiempos: Path, salida: Path):
    """resultados/tiempos.jsonl (una línea por corrida de pipeline.py) -> resultados/benchmark.json."""
    if not tiempos.exists():
        return
    regs = [json.loads(l) for l in tiempos.read_text().splitlines() if l.strip()]
    # La etapa 3 se rehízo (headways en puntos de control): sus tiempos vienen de las corridas «-hw».
    hw = {(r["modo"], r["cpus"]): r["tiempos"]["headways"] for r in regs if r.get("etiqueta") == "fuerte-hw"}
    hw_vol = [r["tiempos"]["headways"] for r in regs if r.get("etiqueta") == "volumen-hw"]
    fuerte = [r for r in regs if r.get("etiqueta") == "fuerte"]
    for r in fuerte:
        r["tiempos"]["headways"] = hw.get((r["modo"], r["cpus"]), r["tiempos"]["headways"])
    for r in regs:
        if r.get("etiqueta") == "volumen" and len(r["dias"].split(",")) == 14 and hw_vol:
            r["tiempos"]["headways"] = hw_vol[-1]
    total = lambda r: {**r["tiempos"], "total": round(sum(r["tiempos"].values()), 2)}
    sec = next((total(r) for r in fuerte if r["modo"] == "secuencial"), None)
    ray = sorted(({"workers": r["cpus"], **total(r)} for r in fuerte if r["modo"] == "ray"), key=lambda r: r["workers"])
    ref = fuerte[0] if fuerte else {}
    d = ref.get("dias", "")
    bench = {
        "maquina": f"Google Colab · CPU High-RAM · {ref.get('nproc', '?')} vCPU",
        "dia": d, "dia_etq": f"martes {int(d[8:10])} de noviembre" if len(d) == 10 else d,
        "archivos": ref.get("archivos"), "mb": ref.get("mb"), "filas": ref.get("filas"),
        "secuencial": sec, "ray": ray,
        "volumen": [{"dias": len(r["dias"].split(",")), "archivos": r["archivos"], "mb": r["mb"], "workers": r["cpus"], **total(r), "filas": r["filas"]}
                    for r in regs if r.get("etiqueta") == "volumen"],
    }
    salida.write_text(json.dumps(bench, ensure_ascii=False, indent=1))


def main():
    rutas, viajes, formas = gtfs()
    agencia_ruta = dict(zip(rutas.route_id, rutas.agency_id))
    viajes_gtfs = set(viajes.trip_id)
    rutas_gtfs = set(rutas.route_id)
    NOMBRE_AG = {"1": "troncal", "2": "alimentador", "6": "dual"}
    tipo = lambda rid: NOMBRE_AG.get(agencia_ruta.get(rid), "zonal" if rid in agencia_ruta else "otro")

    archivos = sorted((DATOS / "raw").rglob("positions_*.pb.gz"), key=hora_archivo)

    # ---------- mapa de calor: buses en servicio por media hora (hora de Bogotá) ----------
    calor = {}
    union = defaultdict(lambda: [0, 0, 0])  # día -> [trip_id en el GTFS de hoy, route_id en el GTFS, reportes]
    zombi = None
    for p in archivos:
        t = hora_archivo(p).astimezone(BOG)
        slot = t.hour * 2 + (t.minute >= 30)
        k = (t.date().isoformat(), slot)
        if k in calor:
            continue
        f = leer(p)
        frescos = [e for e in f.entity if f.header.timestamp - e.vehicle.timestamp < FRESCO]
        calor[k] = {"frescos": len(frescos), "total": len(f.entity)}
        for e in frescos:
            u = union[k[0]]
            u[2] += 1
            u[0] += e.vehicle.trip.trip_id in viajes_gtfs
            u[1] += e.vehicle.trip.route_id in rutas_gtfs
        if zombi is None and len(f.entity) and not frescos and 6 <= t.hour <= 9:
            e = f.entity[0].vehicle
            zombi = {
                "captura": t.strftime("%Y-%m-%d %H:%M"),
                "vehiculos": len(f.entity),
                "ejemplo": {"label": e.vehicle.label, "trip": e.trip.trip_id, "start_date": e.trip.start_date,
                             "reporte": datetime.fromtimestamp(e.timestamp, BOG).strftime("%Y-%m-%d %H:%M")},
            }
    dias = sorted({d for d, _ in calor})
    calor_out = {"dias": dias, "valores": [[calor.get((d, s), {}).get("frescos") for s in range(48)] for d in dias]}

    # ---------- replay + foto del 17 de noviembre ----------
    ventana = [p for p in archivos if REPLAY_INI <= hora_archivo(p) < REPLAY_FIN]
    trayect = defaultdict(dict)  # vehículo -> {ts: (lon, lat)}
    info = {}
    total = nuevas = 0
    sin_nada = 0
    vistos = set()
    edades = []
    foto, foto_t = None, None
    for p in ventana:
        f = leer(p)
        n_nuevas = 0
        for e in f.entity:
            v = e.vehicle
            if f.header.timestamp - v.timestamp >= FRESCO:
                continue
            clave = (v.vehicle.id, v.timestamp)
            total += 1
            if clave not in vistos:
                vistos.add(clave)
                n_nuevas += 1
                trayect[v.vehicle.id][v.timestamp] = (v.position.longitude, v.position.latitude)
                info[v.vehicle.id] = tipo(v.trip.route_id)
        nuevas += n_nuevas
        sin_nada += n_nuevas == 0
        t = hora_archivo(p)
        if foto is None or abs(t - FOTO) < abs(foto_t - FOTO):
            foto, foto_t = f, t
    for e in foto.entity:
        edades.append(foto.header.timestamp - e.vehicle.timestamp)
    edades.sort()
    foto_pts = [[round(e.vehicle.position.longitude, 5), round(e.vehicle.position.latitude, 5), tipo(e.vehicle.trip.route_id)]
                for e in foto.entity if foto.header.timestamp - e.vehicle.timestamp < FRESCO]

    t0 = int(REPLAY_INI.timestamp())
    orden = sorted(trayect, key=lambda k: -len(trayect[k]))
    buses = []
    for vid in orden[:MAX_BUSES_REPLAY]:
        pts, ult = [], -10**9
        for ts, xy in sorted(trayect[vid].items()):
            if ts - ult >= PASO_REPLAY:
                pts.append((ts, xy))
                ult = ts
        if len(pts) < 8:
            continue
        buses.append({"k": info[vid], "p": [[ts - t0, round(x, 5), round(y, 5)] for ts, (x, y) in pts]})

    tipos_foto = Counter(p[2] for p in foto_pts)
    # Volumen estimado de reportes únicos: cada bus reporta un dato nuevo cada `intervalo` s (medido en la ventana
    # del replay); se multiplica por los buses en servicio de cada media hora muestreada.
    en_ventana = [calor[(REPLAY_INI.date().isoformat(), s_)]["frescos"] for s_ in range(REPLAY_INI.hour * 2 + 1, REPLAY_FIN.hour * 2 + 1)]
    intervalo = (REPLAY_FIN - REPLAY_INI).total_seconds() * (sum(en_ventana) / len(en_ventana)) / nuevas
    estimado = sum(v["frescos"] for v in calor.values()) * 1800 / intervalo
    bench_ruta = RAIZ / "resultados" / "benchmark.json"
    resumir_benchmark(RAIZ / "resultados" / "tiempos.jsonl", bench_ruta)
    met_ruta = RAIZ / "resultados" / "metricas.json"
    datos = {
        "generado": datetime.now(BOG).strftime("%Y-%m-%d %H:%M"),
        "archivo": resumen_archivo(),
        "gtfs": {"rutas": len(rutas), "viajes": len(viajes),
                 "stop_times_mb": round(zipfile.ZipFile(DATOS / "gtfs" / "GTFS.zip").getinfo("stop_times.txt").file_size / 1e6)},
        "calor": calor_out,
        "union_gtfs": [{"dia": d, "trip": round(100 * a / n, 1), "ruta": round(100 * b / n, 1)} for d, (a, b, n) in sorted(union.items()) if n],
        "zombi": zombi,
        "replay": {"inicio": REPLAY_INI.isoformat(), "fin": REPLAY_FIN.isoformat(), "capturas": len(ventana),
                   "filas": total, "unicas": nuevas, "capturas_sin_nada": sin_nada,
                   "duplicado_pct": round(100 * (1 - nuevas / total), 1), "n_buses": len(buses), "buses": buses},
        "foto": {"hora": foto_t.astimezone(BOG).strftime("%H:%M:%S"), "n": len(foto_pts), "puntos": foto_pts, "tipos": tipos_foto,
                 "edad_p50": edades[len(edades) // 2], "edad_p90": edades[int(len(edades) * 0.9)]},
        "troncales": troncales(rutas, viajes, formas),
        "volumen": {"intervalo_s": round(intervalo, 1), "reportes_unicos": round(estimado, -5)},
        "benchmark": json.loads(bench_ruta.read_text()) if bench_ruta.exists() else None,
        "metricas": json.loads(met_ruta.read_text()) if met_ruta.exists() else None,
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    print(f"{SALIDA} {SALIDA.stat().st_size / 1e6:.1f} MB")
    print("archivo:", {k: v for k, v in datos["archivo"].items() if k != "por_dia"})
    print("foto:", datos["foto"]["hora"], len(foto_pts), dict(tipos_foto), "edad p50/p90", datos["foto"]["edad_p50"], datos["foto"]["edad_p90"])
    print("replay:", {k: v for k, v in datos["replay"].items() if k != "buses"}, "buses", len(buses))
    print("union:", datos["union_gtfs"])
    print("zombi:", zombi)
    print("volumen:", datos["volumen"])
    print("troncales:", len(datos["troncales"]))
    for d, fila in zip(dias, calor_out["valores"]):
        print(d, " ".join("·" if v is None else ("_" if v < 500 else str(min(9, v // 1000))) for v in fila))


if __name__ == "__main__":
    main()
