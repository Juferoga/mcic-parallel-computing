"""Genera src/mapa.json: la red de calles por donde pasa algún bus (todas las shapes del GTFS), sin repetir tramos,
con las troncales aparte y las 160 estaciones. Uso: uv run --with pandas python presentacion/scripts/exportar_mapa.py"""
import json
import zipfile
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[2]
Q = 0.0004  # grados (~44 m): rejilla para fusionar tramos que comparten varias rutas

z = zipfile.ZipFile(RAIZ / "datos/gtfs/GTFS.zip")
leer = lambda n, **k: pd.read_csv(z.open(n), dtype=str, **k)
rutas = leer("routes.txt", usecols=["route_id", "agency_id"])
viajes = leer("trips.txt", usecols=["route_id", "shape_id"]).drop_duplicates("shape_id")
formas = leer("shapes.txt").astype({"shape_pt_lat": float, "shape_pt_lon": float, "shape_pt_sequence": int})
estaciones = leer("stops.txt").query("location_type == '1'").astype({"stop_lat": float, "stop_lon": float})

troncal = set(viajes.merge(rutas, on="route_id").query("agency_id == '1'").shape_id)
LON0, LAT0 = formas.shape_pt_lon.min(), formas.shape_pt_lat.min()
formas["x"] = ((formas.shape_pt_lon - LON0) / Q).round().astype(int)
formas["y"] = ((formas.shape_pt_lat - LAT0) / Q).round().astype(int)
formas = formas.sort_values(["shape_id", "shape_pt_sequence"])

vistos, salida = set(), {"troncal": [], "red": []}
# Troncales primero: sus tramos quedan marcados como troncal aunque una zonal los comparta.
orden = sorted(formas.shape_id.unique(), key=lambda s: s not in troncal)
grupos = dict(tuple(formas.groupby("shape_id")[["x", "y"]]))
for sid in orden:
    pts = [tuple(map(int, p)) for p in grupos[sid].to_numpy()]
    linea = []
    for a, b in zip(pts, pts[1:]):
        if a == b:
            continue
        k = (min(a, b), max(a, b))
        if k in vistos:
            if len(linea) > 1:
                salida["troncal" if sid in troncal else "red"].append(linea)
            linea = []
            continue
        vistos.add(k)
        if not linea:
            linea = [a]
        linea.append(b)
    if len(linea) > 1:
        salida["troncal" if sid in troncal else "red"].append(linea)

plano = lambda ls: [[c for p in l for c in p] for l in ls]
mapa = {"lon0": round(float(LON0), 6), "lat0": round(float(LAT0), 6), "q": Q,
        "troncal": plano(salida["troncal"]), "red": plano(salida["red"]),
        "estaciones": [[round(r.stop_lon, 5), round(r.stop_lat, 5)] for r in estaciones.itertuples()]}
dest = RAIZ / "presentacion/src/mapa.json"
dest.write_text(json.dumps(mapa, separators=(",", ":")))
print(f"troncal {len(salida['troncal'])} líneas · red {len(salida['red'])} líneas · {len(vistos)} tramos · "
      f"{len(mapa['estaciones'])} estaciones · {dest.stat().st_size/1e6:.2f} MB")
