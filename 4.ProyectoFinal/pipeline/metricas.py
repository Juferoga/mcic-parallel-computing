"""Reduce las salidas del pipeline (trayectorias/ y headways/) a resultados/metricas.json para la presentación.

Se procesa día por día para no cargar todo en memoria. Las medianas de varios días se reportan como el promedio
de las medianas diarias (las medianas no se pueden combinar exactamente sin juntar los datos).

  python metricas.py --out /ruta/salida/pipeline --gtfs ../datos/gtfs/GTFS.zip --json ../resultados/metricas.json
"""

import argparse
import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from tm import nucleo

HABILES = ["2026-11-12", "2026-11-13", "2026-11-17"]
COMPLETOS = HABILES + ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-21", "2026-11-22"]
TIPO_AGENCIA = {"1": "troncal", "2": "alimentador", "6": "dual"}


def vel(df):
    """Velocidad comercial (km/h): distancia total sobre tiempo total, incluye detenciones."""
    h = df.dt.sum() / 3600
    return round(float(df.km.sum() / h), 2) if h > 0 else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--gtfs", required=True)
    ap.add_argument("--json", required=True)
    a = ap.parse_args()
    out = Path(a.out)

    z = zipfile.ZipFile(a.gtfs)
    rutas = pd.read_csv(io.BytesIO(z.read("routes.txt")), dtype=str)
    tipo = {r: TIPO_AGENCIA.get(ag, "zonal") for r, ag in zip(rutas.route_id, rutas.agency_id)}
    nombre = dict(zip(rutas.route_id, rutas.route_short_name.fillna("") + " · " + rutas.route_long_name.fillna("")))
    geos = nucleo.cargar_geometrias(a.gtfs)

    por_dia, hora_tipo, tramos, totales = [], [], [], {"reportes": 0, "emparejados": 0, "velocidades": 0}
    for carpeta in sorted((out / "trayectorias").glob("dia=*")):
        dia = carpeta.name.split("=", 1)[1]
        t = pd.read_parquet(carpeta, columns=["route_id", "hora", "v_kmh", "dt", "tramo", "desvio"])
        totales["reportes"] += len(t)
        totales["emparejados"] += int((t.desvio <= nucleo.MAX_DESVIO).sum())
        t = t[t.v_kmh.notna()].copy()
        totales["velocidades"] += len(t)
        t["km"] = t.v_kmh * t.dt / 3600  # distancia del intervalo: velocidad comercial = Σkm / Σh
        t["tipo"] = t.route_id.map(tipo).fillna("otro")
        dia_serv = t[(t.hora >= 6) & (t.hora <= 20)]
        por_dia.append({"dia": dia, "v_comercial": vel(dia_serv), **{k: vel(g) for k, g in dia_serv.groupby("tipo")}})
        if dia in HABILES:
            g = t.groupby(["tipo", "hora"]).agg(km=("km", "sum"), s=("dt", "sum"), size=("dt", "size")).reset_index()
            g["median"] = g.km / (g.s / 3600)
            g["dia"] = dia
            hora_tipo.append(g)
            # Velocidad por tramo de 500 m de las troncales en el pico de la mañana (6–8 h).
            p = t[(t.tipo == "troncal") & t.hora.between(6, 7) & (t.tramo >= 0)]
            g = p.groupby(["route_id", "tramo"]).agg(km=("km", "sum"), s=("dt", "sum"), size=("dt", "size")).reset_index()
            tramos.append(g.assign(median=g.km / (g.s / 3600), dia=dia))

    ht = pd.concat(hora_tipo)
    ht = ht[ht["size"] >= 200].groupby(["tipo", "hora"])["median"].mean().round(2).reset_index()
    velocidad_hora = {k: g.set_index("hora")["median"].to_dict() for k, g in ht.groupby("tipo")}

    tr = pd.concat(tramos)
    tr = tr.groupby(["route_id", "tramo"]).agg(v=("median", "mean"), n=("size", "sum")).reset_index()
    tr = tr[tr.n >= 30]
    # Fuera la cabecera y el final de cada ruta: ahí el bus espera en el portal y la «velocidad» es 0.
    largo = {r: g[1][-1] for r, g in geos.items()}
    ultimo = tr.route_id.map(largo).fillna(0) // nucleo.TRAMO
    tr = tr[(tr.tramo >= 1) & (tr.tramo < ultimo - 1)]
    mapa = []
    for r in tr.itertuples():
        geo = geos.get(r.route_id)
        if geo is None:
            continue
        q, acum = geo
        s = (r.tramo + 0.5) * nucleo.TRAMO
        if s > acum[-1]:
            continue
        x = np.interp(s, acum, q[:, 0]); y = np.interp(s, acum, q[:, 1])
        mapa.append([round(x / nucleo.KX - 74.1, 5), round(y / nucleo.KY + nucleo.LAT0, 5), round(r.v, 1), r.route_id])
    lentos = (tr[tr.n >= 300].sort_values("v").head(12)
              .assign(ruta=lambda d: d.route_id.map(nombre), km=lambda d: d.tramo * nucleo.TRAMO / 1000)
              [["ruta", "km", "v", "n"]].round(1).to_dict("records"))

    # Headways y bunching (días hábiles, 6–20 h, intervalos de hasta 2 h) en puntos de control cada 1 km.
    hw = []
    for d in HABILES:
        f = out / "headways" / f"dia={d}.parquet"
        if not f.exists():
            continue
        h = pd.read_parquet(f)
        h = h[(h.hora >= 6) & (h.hora <= 20) & (h.headway_s <= 7200)]
        med = h.groupby(["route_id", "punto"]).headway_s.transform("median")
        h = h.assign(bunching=h.headway_s < 0.25 * med, tipo=h.route_id.map(tipo).fillna("otro"))
        hw.append(h)
    hw = pd.concat(hw) if hw else pd.DataFrame(columns=["hora", "headway_s", "bunching", "tipo"])
    headway_hora = (hw.groupby("hora").headway_s.median() / 60).round(1).to_dict()
    bunching_hora = (hw.groupby("hora").bunching.mean() * 100).round(1).to_dict()
    bunching_tipo = (hw.groupby("tipo").bunching.mean() * 100).round(1).to_dict()

    res = {
        "totales": {**totales, "emparejado_pct": round(100 * totales["emparejados"] / max(totales["reportes"], 1), 1)},
        "velocidad_dia": por_dia,
        "velocidad_hora_tipo": velocidad_hora,
        "velocidad_pico_habil": round(float(ht[ht.hora.isin([6, 7])]["median"].mean()), 1) if len(ht) else None,
        "tramos_pico": mapa,
        "tramos_lentos": lentos,
        "headway_mediana_min_hora": headway_hora,
        "headway_mediana_min": round(float(hw.headway_s.median() / 60), 1) if len(hw) else None,
        "bunching_pct": round(float(hw.bunching.mean() * 100), 1) if len(hw) else None,
        "bunching_hora": bunching_hora,
        "bunching_tipo": bunching_tipo,
        "dias_habiles": HABILES,
    }
    Path(a.json).parent.mkdir(parents=True, exist_ok=True)
    def limpio(o):  # NaN -> null (JSON válido) y llaves numéricas como enteros
        if isinstance(o, dict):
            return {(str(int(k)) if isinstance(k, float) else str(k)): limpio(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)):
            return [limpio(v) for v in o]
        if isinstance(o, (float, np.floating)):
            return None if np.isnan(o) else round(float(o), 2)
        if isinstance(o, np.integer):
            return int(o)
        return o
    res = limpio(res)
    Path(a.json).write_text(json.dumps(res, ensure_ascii=False))
    print(json.dumps({k: v for k, v in res.items() if k not in ("tramos_pico",)}, ensure_ascii=False)[:3000])


if __name__ == "__main__":
    main()
