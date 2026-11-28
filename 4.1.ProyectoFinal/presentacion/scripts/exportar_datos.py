"""Exporta src/datos.json para la presentación a partir de las salidas del pipeline (resultados/) y de una ventana de
capturas crudas (solo para los buses que se mueven en el fondo).

Entradas (rutas desde 4.1.ProyectoFinal/):
  resultados/resumen.json, validacion.json, carriles.json, walkforward.json, calidad.csv
  resultados/ranking_mixto.csv, ranking_exclusivo.csv, menos_confiables_mixto.csv, menos_confiables_exclusivo.csv
  resultados/tramos.parquet          capa del mapa: velocidad del pico y retraso por celda de 250 m
  resultados/tiempos.jsonl y tiempos_local.jsonl   corridas del pipeline (speedup: etiqueta «fuerte-local»)
  datos/raw/2026/11/23/positions_*.pb.gz           buses del fondo (pico de la tarde)
  datos/gtfs/GTFS.zip                              troncales y tipo de servicio de cada ruta

Uso, desde 4.1.ProyectoFinal/pipeline/:
  uv run --with pyarrow python ../presentacion/scripts/exportar_datos.py
"""

import csv
import gzip
import io
import json
import math
import re
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from google.transit import gtfs_realtime_pb2

RAIZ = Path(__file__).resolve().parents[2]  # 4.1.ProyectoFinal
DATOS, RES = RAIZ / "datos", RAIZ / "resultados"
SALIDA = RAIZ / "presentacion" / "src" / "datos.json"
BOG = timezone(timedelta(hours=-5))
FRESCO = 300  # s: un reporte con más de 5 min de antigüedad no cuenta (zombi)
PICO = [6, 7, 17, 18]
CELDA = 250.0  # m, la misma celda del ranking (tm/nucleo.py)
CAMBIO_FEED = "2026-11-18"  # desde ese día el feed trae más buses

# Buses del fondo: lunes 23 de noviembre, pico de la tarde (hora de Bogotá). La mañana del 23 el feed se congeló.
REPLAY_INI = datetime(2026, 11, 23, 17, 0, tzinfo=BOG)
REPLAY_FIN = datetime(2026, 11, 23, 18, 30, tzinfo=BOG)
MAX_BUSES_REPLAY = 1600
PASO_REPLAY = 60  # s entre puntos de una trayectoria


def hora_archivo(p: Path) -> datetime:
    s = re.search(r"_(\d{8}T\d{6})Z", p.name).group(1)
    return datetime.strptime(s, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)


def gtfs():
    z = zipfile.ZipFile(DATOS / "gtfs" / "GTFS.zip")
    rd = lambda n, **kw: pd.read_csv(io.BytesIO(z.read(n)), dtype=str, **kw)
    return rd("routes.txt"), rd("trips.txt", usecols=["route_id", "shape_id", "trip_id"]), rd("shapes.txt")


def troncales(rutas, viajes, formas):
    """Una geometría por ruta troncal (agency 1), simplificada, para el piso del mapa 3D y los minimapas."""
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
        red = [pts[0]]  # un punto cada ~60 m, conserva los extremos
        for p in pts[1:-1]:
            if abs(p[0] - red[-1][0]) + abs(p[1] - red[-1][1]) > 0.0006:
                red.append(p)
        red.append(pts[-1])
        clave = tuple(round(c, 3) for c in red[0] + red[-1])
        if clave in vistos:
            continue
        vistos.add(clave)
        lineas.append({"p": [[round(x, 5), round(y, 5)] for x, y in red]})
    return lineas


def replay(tipo):
    """Trayectorias de los buses en la ventana, un punto por minuto: los buses que se mueven en el fondo."""
    dias = {REPLAY_INI.astimezone(timezone.utc).date(), REPLAY_FIN.astimezone(timezone.utc).date()}
    archivos = sorted((p for d in dias for p in (DATOS / "raw" / f"{d:%Y/%m/%d}").glob("positions_*.pb.gz")
                       if REPLAY_INI <= hora_archivo(p) < REPLAY_FIN), key=hora_archivo)
    trayect, info = defaultdict(dict), {}
    for p in archivos:
        f = gtfs_realtime_pb2.FeedMessage()
        f.ParseFromString(gzip.open(p).read())
        for e in f.entity:
            v = e.vehicle
            if f.header.timestamp - v.timestamp >= FRESCO:
                continue
            trayect[v.vehicle.id][v.timestamp] = (v.position.longitude, v.position.latitude)
            info[v.vehicle.id] = tipo(v.trip.route_id)
    t0 = int(REPLAY_INI.timestamp())
    buses = []
    for vid in sorted(trayect, key=lambda k: -len(trayect[k]))[:MAX_BUSES_REPLAY]:
        pts, ult = [], -10**9
        for ts, xy in sorted(trayect[vid].items()):
            if ts - ult >= PASO_REPLAY:
                pts.append((ts, xy))
                ult = ts
        if len(pts) >= 8:
            buses.append({"k": info[vid], "p": [[ts - t0, round(x, 5), round(y, 5)] for ts, (x, y) in pts]})
    return {"inicio": REPLAY_INI.isoformat(), "fin": REPLAY_FIN.isoformat(), "capturas": len(archivos), "buses": buses}


def corridas():
    regs = []
    for n in ("tiempos.jsonl", "tiempos_local.jsonl"):
        p = RES / n
        if p.exists():
            regs += [json.loads(l) for l in p.read_text().splitlines() if l.strip()]
    return regs


def benchmark(regs):
    """Escalamiento fuerte («fuerte-local»): secuencial y Ray con 1, 2, 4, 8 workers sobre el mismo día. Si una
    configuración se corrió dos veces, vale la última. None si todavía no hay ninguna línea."""
    fuerte = {}
    for r in regs:
        if r.get("etiqueta") == "fuerte-local":
            fuerte[(r["modo"], r["cpus"])] = r
    if not fuerte:
        return None
    total = lambda r: {**r["tiempos"], "total": round(sum(r["tiempos"].values()), 2)}
    sec = next((r for (m, _), r in fuerte.items() if m == "secuencial"), None)
    ray = sorted(({"workers": c, **total(r)} for (m, c), r in fuerte.items() if m == "ray"), key=lambda r: r["workers"])
    ref = sec or next(iter(fuerte.values()))
    d = ref["dias"]
    return {"maquina": f"local · {ref.get('nproc', '?')} núcleos", "dia": d,
            "dia_etq": f"{int(d[8:10])} de noviembre" if len(d) == 10 else d,
            "archivos": ref.get("archivos"), "mb": ref.get("mb"), "etapas": list(ref["tiempos"]),
            "secuencial": total(sec) if sec else None, "ray": ray}


def completo(regs):
    """Corrida completa: la última («local-completo-v2», recorridos en adelante con las correcciones) completada con las
    etapas que no repitió (el ETL de «local-completo»)."""
    cs = [r for r in regs if str(r.get("etiqueta", "")).startswith("local-completo")]
    if not cs:
        return None
    r = {**cs[-1], "tiempos": {k: v for c in cs for k, v in c["tiempos"].items()},
         "filas": {k: v for c in cs for k, v in c["filas"].items()}}
    return {"dias_lista": sorted(r["dias"].split(",")), "cpus": r["cpus"], "archivos": r["archivos"], "gb": round(r["mb"] / 1000, 1), "dias": len(r["dias"].split(",")),
            "tiempos": r["tiempos"], "total_min": round(sum(r["tiempos"].values()) / 60), "filas": r["filas"],
            "posiciones_m": round(r["filas"]["posiciones"] / 1e6, 1), "recorridos_m": round(r["filas"]["recorridos"] / 1e6, 1)}


def calidad(dias):
    """Buses por hora y día (mapa de calor) y las cifras de calidad del archivo."""
    c = pd.read_csv(RES / "calidad.csv")
    c = c[c.dia.isin(dias)]
    tabla = c.pivot_table(index="dia", columns="hora", values="buses", aggfunc="first").reindex(index=dias, columns=range(24))
    valores = [[None if pd.isna(v) else int(v) for v in fila] for fila in tabla.to_numpy()]
    rep = c.reportes.sum()
    dup = (c.reportes * c.duplicados_pct.fillna(0) / 100).sum() / rep
    servicio = c[c.hora.between(5, 22)]
    pico_dia = c.groupby("dia").buses.max()
    lab = [d for d in dias if pd.Timestamp(d).weekday() < 5 and d != "2026-11-16"]
    return {"dias": dias, "valores": valores, "reportes_m": round(rep / 1e6, 1), "duplicado_pct": round(100 * dup, 1),
            "edad_mediana_s": round(float(servicio.edad_mediana_s.median())),
            "buses_antes": int(pico_dia[[d for d in lab if d < CAMBIO_FEED]].median()),
            "buses_despues": int(pico_dia[[d for d in lab if d > CAMBIO_FEED]].median())}


def mapa_tramos():
    """Capa del mapa: celdas de 250 m con la velocidad mediana del pico (6–8 y 17–19 h, días hábiles), ponderada por
    pasadas, y las bus-horas de retraso por día hábil de todas las rutas que pasan por la celda."""
    t = pd.read_parquet(RES / "tramos.parquet", columns=["route_id", "tramo", "tipo_dia", "hora", "n", "v_p50", "retraso_h", "x", "y"])
    t = t[t.tipo_dia == "laboral"].assign(cx=lambda d: (d.x // CELDA).astype(int), cy=lambda d: (d.y // CELDA).astype(int))
    ret = t.groupby(["cx", "cy"]).retraso_h.sum()
    p = t[t.hora.isin(PICO)].assign(vn=lambda d: d.v_p50 * d.n)
    g = p.groupby(["cx", "cy"]).agg(vn=("vn", "sum"), n=("n", "sum"))
    g = g[g.n >= 20]
    g["v"] = g.vn / g.n
    g = g.join(ret)
    # Centro de la celda en grados: inversa de tm/nucleo.a_metros.
    kx, ky = 111_320.0 * math.cos(math.radians(4.65)), 110_540.0
    g = g.reset_index()
    g["lon"] = (g.cx + 0.5) * CELDA / kx - 74.1
    g["lat"] = (g.cy + 0.5) * CELDA / ky + 4.65
    return [[round(r.lon, 4), round(r.lat, 4), round(r.v, 1), round(r.retraso_h, 1)] for r in g.itertuples()]


def ranking(nombre, top=20):
    filas = list(csv.DictReader(open(RES / f"ranking_{nombre}.csv")))[:top]
    return [{"puesto": int(f["puesto"]) + 1, "h": round(float(f["retraso_h"]), 1), "rutas": int(f["rutas"]),
             "top": f["rutas_top"], "sis": f["sistemas"], "v": round(float(f["v_p50_pico"]), 1) if f["v_p50_pico"] else None,
             "lon": round(float(f["lon"]), 4), "lat": round(float(f["lat"]), 4),
             "ic": [round(float(f["ic_bajo"]), 1), round(float(f["ic_alto"]), 1)]} for f in filas]


def menos_confiables(nombre, top=5):
    """Los pares con más colchón (p95 − p50), uno por ruta para no repetir la misma línea."""
    sal, vistas = [], set()
    for f in csv.DictReader(open(RES / f"menos_confiables_{nombre}.csv")):
        if f["ruta"] in vistas:
            continue
        vistas.add(f["ruta"])
        sal.append({"ruta": f["ruta"], "sis": f["sistema"], "desde": f["desde"], "hasta": f["hasta"], "hora": int(f["hora"]),
                    "n": int(f["n"]), "p50": round(float(f["p50_min"])), "p95": round(float(f["p95_min"])), "bti": float(f["bti"])})
        if len(sal) == top:
            break
    return sal


def main():
    rutas, viajes, formas = gtfs()
    agencia = dict(zip(rutas.route_id, rutas.agency_id))
    NOMBRE_AG = {"1": "troncal", "2": "alimentador", "6": "dual"}
    tipo = lambda rid: NOMBRE_AG.get(agencia.get(rid), "zonal" if rid in agencia else "otro")

    leer = lambda n: json.loads((RES / n).read_text())
    regs = corridas()
    comp = completo(regs)
    dias = comp["dias_lista"]
    resumen = leer("resumen.json")
    bh = resumen["bus_horas_retraso_dia_habil"]
    resumen["bus_horas_mixto"] = round(bh["zonal"] + bh["alimentador"])
    resumen["bus_horas_exclusivo"] = round(bh["troncal"] + bh["dual"])
    wf = leer("walkforward.json")
    wf["cobertura_pct"] = round(100 * wf["cobertura"], 1)
    wf["viajes_prueba_m"] = round(wf["viajes_prueba"] / 1e6, 1)
    val = leer("validacion.json")
    s = val["sintetico_52s"]
    val["sintetico_52s"] = {**s, "sesgo_pct": round(100 * s["sesgo_rel"], 1), "mediana_pct": round(100 * s["mediana_abs_rel"], 1),
                            "p90_pct": round(100 * s["p90_abs_rel"], 1)}

    datos = {
        "generado": datetime.now(BOG).strftime("%Y-%m-%d %H:%M"),
        "completo": comp,
        "calidad": calidad(dias),
        "benchmark": benchmark(regs),
        "resumen": resumen,
        "validacion": val,
        "carriles": leer("carriles.json"),
        "walkforward": wf,
        "accesibilidad": leer("accesibilidad.json") if (RES / "accesibilidad.json").exists() else None,
        "economia": leer("economia.json"),
        "ranking": {"mixto": ranking("mixto"), "exclusivo": ranking("exclusivo")},
        "confiables": {"mixto": menos_confiables("mixto"), "exclusivo": menos_confiables("exclusivo")},
        "mapa_tramos": mapa_tramos(),
        "troncales": troncales(rutas, viajes, formas),
        "replay": replay(tipo),
    }
    SALIDA.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    print(f"{SALIDA} {SALIDA.stat().st_size / 1e6:.1f} MB")
    print("completo:", comp)
    print("calidad:", {k: v for k, v in datos["calidad"].items() if k != "valores"})
    print("benchmark:", datos["benchmark"])
    print("mapa_tramos:", len(datos["mapa_tramos"]), "celdas · troncales:", len(datos["troncales"]))
    print("replay:", datos["replay"]["capturas"], "capturas,", len(datos["replay"]["buses"]), "buses")


if __name__ == "__main__":
    main()
