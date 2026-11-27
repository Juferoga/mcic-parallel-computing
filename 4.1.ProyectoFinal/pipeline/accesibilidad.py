"""Proyecto 3: brecha de accesibilidad al empleo entre el horario y la operación observada, por estrato.

  1. zonas       ZAT de la EM2023 con empleo (viajes a trabajar que llegan) y estrato (mediana de sus hogares)
  2. gtfs        tres GTFS de día hábil (5:30 a 10:00): programado; observado típico (cada salto entre paradas con la
                 mediana de sus tramos a esa hora); observado lento (p80 de la duración de cada tramo)
  3. matrices    r5py desde los centroides de las ZAT de Bogotá, salidas de 6:30 a 8:30 (mediana de la ventana).
                 Ray: actores que cargan la red R5 una vez (la parte cara) y reciben lotes de orígenes
  4. acceso      empleos alcanzables en 45, 60 y 90 min, por ZAT y por estrato, y la brecha frente al horario

Uso (uv sync --group acceso):
  python accesibilidad.py --gtfs ../datos/gtfs/GTFS.zip --osm ../datos/osm/Bogota.osm.pbf --em ../datos/em2023 \
      --resultados ../resultados --trabajo ../datos/salida/acceso --actores 2 --memoria 3G
"""

import argparse
import io
import json
import os
import time
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

from tm import acceso, confiable, nucleo

LUNES = {"1", "3", "5", "7"}         # service_id que operan los lunes (calendar.txt)
VENTANA = (5 * 3600 + 1800, 10 * 3600)
UMBRALES = (45, 60, 90)
ESCENARIOS = ("programado", "observado", "observado_lento")


def leer_em(em: Path):
    csv = next(em.glob("05_*/CSV"))
    leer = lambda n: pd.read_csv(next(csv.glob(n)), sep=";", encoding="latin-1", low_memory=False).rename(columns=str.strip)
    return leer("d. *viajes*.csv"), leer("a. *hogares*.csv")


def centroides(em: Path, zonas: pd.DataFrame):
    import geopandas as gpd
    z = gpd.read_file(next(em.glob("zat/**/ZAT2023.shp")))
    z = z[z.ZAT.isin(zonas.zat)].to_crs(3116)
    c = z.assign(geometry=z.representative_point()).to_crs(4326)
    return c.rename(columns={"ZAT": "id"})[["id", "geometry"]].astype({"id": int})


def gtfs_dia_habil(gtfs: str, salida: Path, obs: dict | None, par: pd.DataFrame) -> Path:
    """GTFS recortado a un día hábil por la mañana; si `obs` existe, los tiempos se reprograman con lo observado."""
    z = zipfile.ZipFile(gtfs)
    trips = pd.read_csv(io.BytesIO(z.read("trips.txt")), dtype=str)
    trips = trips[trips.service_id.isin(LUNES)]
    st = confiable.leer_stop_times(z, confiable.HORARIO + ["departure_time"])
    st = st[st.trip_id.isin(set(trips.trip_id))]
    hms = st.arrival_time.str.split(":", expand=True).astype(np.int64)
    st["t"] = hms[0] * 3600 + hms[1] * 60 + hms[2]
    ini = st.groupby("trip_id").t.transform("min")
    st = st[(ini >= VENTANA[0]) & (ini <= VENTANA[1])].copy()
    st["route_id"] = st.trip_id.str.rsplit(".", n=1).str[-1]
    if obs is not None:
        s = dict(zip(zip(par.route_id, par.stop_id), par.s))
        st = st.sort_values(["trip_id", "stop_sequence"]).reset_index(drop=True)
        st["t"] = acceso.reprogramar(st, s, obs).to_numpy()
    hhmmss = lambda t: (t // 3600).astype(str).str.zfill(2) + ":" + (t % 3600 // 60).astype(str).str.zfill(2) + ":" + (t % 60).astype(str).str.zfill(2)
    st["arrival_time"] = st["departure_time"] = hhmmss(st.t)
    salida.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(salida, "w", zipfile.ZIP_DEFLATED) as w:
        for n in ("agency.txt", "routes.txt", "stops.txt", "calendar.txt", "feed_info.txt"):
            w.writestr(n, z.read(n))
        w.writestr("trips.txt", trips[trips.trip_id.isin(set(st.trip_id))].to_csv(index=False))
        w.writestr("stop_times.txt", st[["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence"]].to_csv(index=False))
    return salida


def tiempos_observados(tramos: pd.DataFrame, columna_v: str) -> dict:
    """tramos de día hábil -> {(ruta, tramo, hora): segundos} con la velocidad `columna_v` (v_p50 o v_p20)."""
    t = tramos[(tramos.tipo_dia == "laboral") & (tramos[columna_v] > 0)]
    return dict(zip(zip(t.route_id, t.tramo, t.hora), nucleo.TRAMO / (t[columna_v] / 3.6)))


class Ruteador:
    """Actor de Ray: carga la red R5 (OSM + GTFS) una vez y calcula matrices para lotes de orígenes."""

    def __init__(self, osm: str, gtfs: str, memoria: str):
        import sys
        sys.argv += ["--max-memory", memoria]  # cada actor es una JVM: sin esto cada una pide el 80 % de la RAM
        import r5py
        self.r5py = r5py
        self.red = r5py.TransportNetwork(osm, [gtfs])

    def matriz(self, origenes, destinos):
        import datetime as dt
        r = self.r5py.TravelTimeMatrix(self.red, origins=origenes, destinations=destinos,
                                       departure=dt.datetime(2026, 11, 23, 6, 30),
                                       departure_time_window=dt.timedelta(hours=2),
                                       transport_modes=[self.r5py.TransportMode.TRANSIT, self.r5py.TransportMode.WALK],
                                       max_time=dt.timedelta(minutes=max(UMBRALES)))
        return pd.DataFrame(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gtfs", required=True)
    ap.add_argument("--osm", required=True)
    ap.add_argument("--em", required=True)
    ap.add_argument("--resultados", required=True)
    ap.add_argument("--trabajo", required=True)
    ap.add_argument("--actores", type=int, default=2)
    ap.add_argument("--memoria", default="3G")
    ap.add_argument("--lote", type=int, default=50)
    ap.add_argument("--max-origenes", type=int, default=0, help="piloto: solo los primeros N orígenes")
    ap.add_argument("--tiempos", help="agrega una línea JSON con los tiempos")
    a = ap.parse_args()
    res, trab = Path(a.resultados), Path(a.trabajo)
    trab.mkdir(parents=True, exist_ok=True)
    t = {}

    t0 = time.perf_counter()
    viajes, hogares = leer_em(Path(a.em))
    z = acceso.zonas(viajes, hogares)
    pts = centroides(Path(a.em), z)
    bog = pts[pts.id.isin(z[z.estrato.notna()].zat)]                 # orígenes: ZAT de Bogotá con hogares
    origenes = bog.head(a.max_origenes) if a.max_origenes else bog
    t["zonas"] = time.perf_counter() - t0

    t0 = time.perf_counter()
    geos = nucleo.cargar_geometrias(a.gtfs)
    par = confiable.paradas(a.gtfs, geos)
    tramos = pd.read_parquet(res / "tramos.parquet", columns=["route_id", "tramo", "tipo_dia", "hora", "v_p50", "v_p20"])
    obs = {"programado": None, "observado": tiempos_observados(tramos, "v_p50"),
           "observado_lento": tiempos_observados(tramos, "v_p20")}
    archivos = {e: gtfs_dia_habil(a.gtfs, trab / f"gtfs_{e}.zip", obs[e], par) for e in ESCENARIOS}
    t["gtfs"] = time.perf_counter() - t0

    os.environ.setdefault("RAY_ENABLE_UV_RUN_RUNTIME_ENV", "0")
    import ray
    ray.init(num_cpus=a.actores, include_dashboard=False, log_to_driver=False)
    Actor = ray.remote(num_cpus=1)(Ruteador)
    matrices = {}
    for e in ESCENARIOS:
        t0 = time.perf_counter()
        actores = [Actor.remote(a.osm, str(archivos[e]), a.memoria) for _ in range(a.actores)]
        lotes = [origenes.iloc[i:i + a.lote] for i in range(0, len(origenes), a.lote)]
        partes = ray.get([actores[i % len(actores)].matriz.remote(l, pts) for i, l in enumerate(lotes)])
        matrices[e] = pd.concat(partes, ignore_index=True)
        matrices[e].to_parquet(trab / f"matriz_{e}.parquet", index=False)
        for x in actores:
            ray.kill(x)
        t[f"matriz_{e}"] = time.perf_counter() - t0
    ray.shutdown()

    empleo = z.set_index("zat").empleo
    estr = z.set_index("zat").estrato
    tabla = pd.DataFrame({"zat": origenes.id.to_numpy()})
    for e, m in matrices.items():
        for u in UMBRALES:
            tabla[f"{e}_{u}"] = tabla.zat.map(acceso.acumulada(m, empleo, u)).fillna(0.0)
    tabla["estrato"] = tabla.zat.map(estr)
    for u in UMBRALES:
        for e in ESCENARIOS[1:]:
            tabla[f"brecha_{e}_{u}"] = tabla[f"{e}_{u}"] / tabla[f"programado_{u}"].replace(0, np.nan) - 1
    tabla.to_parquet(res / "accesibilidad.parquet", index=False)
    total = float(empleo.sum())
    por_estrato = tabla.groupby(tabla.estrato.round()).agg(
        zonas=("zat", "size"), **{f"{e}_60_pct": (f"{e}_60", lambda x: round(100 * x.median() / total, 2)) for e in ESCENARIOS},
        brecha_obs_60=("brecha_observado_60", "median"), brecha_lento_60=("brecha_observado_lento_60", "median"))
    resumen = {"zonas_origen": len(tabla), "empleo_total": round(total), "por_estrato": por_estrato.round(3).reset_index().to_dict("records"),
               "brecha_mediana_60": {e: round(float(tabla[f"brecha_{e}_60"].median()), 3) for e in ESCENARIOS[1:]},
               "tiempos_s": {k: round(v, 1) for k, v in t.items()}, "actores": a.actores}
    json.dump(resumen, open(res / "accesibilidad.json", "w"), ensure_ascii=False, indent=1)
    if a.tiempos:
        with open(a.tiempos, "a") as f:
            f.write(json.dumps({"etiqueta": "acceso", "actores": a.actores, "origenes": len(origenes), "tiempos": resumen["tiempos_s"]}) + "\n")
    print(json.dumps(resumen, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
