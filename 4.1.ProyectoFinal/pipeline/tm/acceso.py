"""Proyecto 3: cuántos empleos alcanza cada zona de Bogotá en transporte público, según el horario y según la
operación observada, y si la brecha es mayor en los estratos bajos.

Datos: ZAT y viajes de la Encuesta de Movilidad 2023 (Observatorio de Movilidad), recorte OSM de Bogotá (BBBike) y el
GTFS. El empleo de cada ZAT se aproxima con los viajes con motivo "A trabajar" que llegan a ella (ponderados por el
factor de expansión): no es un censo de empleo, pero incluye el informal.
"""

import numpy as np
import pandas as pd

from tm import nucleo


def numero(s: pd.Series) -> pd.Series:
    """' 46,63 ' -> 46.63; '1.234,5' -> 1234.5; ' - ' -> NaN (formato de la encuesta)."""
    return pd.to_numeric(s.astype(str).str.strip().str.replace(".", "", regex=False).str.replace(",", ".", regex=False),
                         errors="coerce")


def mediana_ponderada(x: pd.Series, w: pd.Series) -> float:
    o = np.argsort(x.to_numpy())
    x, w = x.to_numpy()[o], w.to_numpy()[o]
    return float(x[np.searchsorted(np.cumsum(w), w.sum() / 2)]) if len(x) else np.nan


def zonas(viajes: pd.DataFrame, hogares: pd.DataFrame) -> pd.DataFrame:
    """ZAT -> empleo (viajes a trabajar con destino en Bogotá, expandidos) y estrato (mediana ponderada de los
    hogares de Bogotá en la ZAT)."""
    v = viajes[(viajes.motivo_viaje.str.strip() == "A trabajar") & (viajes.nom_mun_des.str.strip() == "Bogotá")]
    empleo = numero(v.fexp_vj).groupby(v.zat_des).sum()
    h = hogares[hogares.nom_mpio_hg.str.startswith("Bogot")].assign(e=lambda d: pd.to_numeric(d.estrato_hg, errors="coerce"),
                                                                     w=lambda d: numero(d.fexp_hg))
    h = h.dropna(subset=["e", "w"])
    estrato = h.groupby("zat_hg").apply(lambda g: mediana_ponderada(g.e, g.w), include_groups=False)
    todas = pd.Index(viajes.zat_des).union(pd.Index(hogares.zat_hg)).unique()
    z = pd.DataFrame({"empleo": empleo, "estrato": estrato}).reindex(todas)
    z.index.name = "zat"
    return z.assign(empleo=z.empleo.fillna(0.0)).reset_index()


def reprogramar(st: pd.DataFrame, s: dict, obs: dict) -> pd.Series:
    """stop_times de viajes (trip_id, route_id, stop_id, stop_sequence, t en s desde medianoche) -> nuevos tiempos de
    llegada con los tiempos de tramo observados. Cada salto entre paradas suma, por cada tramo de 500 m que cruza, la
    fracción recorrida × el tiempo observado de ese tramo (ruta, tramo, hora de salida del salto). Si un tramo no tiene
    dato, o la parada no está ubicada sobre la ruta, usa la parte proporcional del horario. Conserva la salida de la
    primera parada de cada viaje."""
    st = st.sort_values(["trip_id", "stop_sequence"]).reset_index(drop=True)
    pos = pd.Series([s.get(k, np.nan) for k in zip(st.route_id, st.stop_id)], dtype=float)
    mismo = st.trip_id.eq(st.trip_id.shift(-1)).to_numpy()
    sa, sb = pos.to_numpy(), pos.shift(-1).to_numpy()
    prog = (st.t.shift(-1) - st.t).to_numpy()
    hora = (st.t.to_numpy() // 3600) % 24
    ok = mismo & ~np.isnan(sa) & ~np.isnan(sb) & (sb > sa)
    nuevo = np.where(mismo, prog, 0.0)                          # por defecto: el horario
    i = np.flatnonzero(ok)
    if len(i):
        k0 = np.floor(sa[i] / nucleo.TRAMO).astype(np.int64)
        k1 = np.ceil(sb[i] / nucleo.TRAMO).astype(np.int64) - 1
        n = k1 - k0 + 1
        h = np.repeat(i, n)
        k = np.repeat(k0, n) + (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n))
        lado = np.minimum(sb[h], (k + 1) * nucleo.TRAMO) - np.maximum(sa[h], k * nucleo.TRAMO)
        t_obs = np.array([obs.get(x, np.nan) for x in zip(st.route_id.to_numpy()[h], k, hora[h])])
        aporte = np.where(np.isnan(t_obs), prog[h] * lado / (sb[h] - sa[h]), t_obs * lado / nucleo.TRAMO)
        nuevo[i] = np.bincount(np.searchsorted(i, h), weights=aporte, minlength=len(i))
    salto = np.concatenate([[0.0], nuevo[:-1]])
    inicio = ~st.trip_id.eq(st.trip_id.shift()).to_numpy()
    salto[inicio] = 0.0
    base = st.t.where(inicio).ffill().to_numpy()
    return pd.Series(base + pd.Series(salto).groupby(st.trip_id).cumsum().to_numpy(), index=st.index).round().astype(np.int64)


def acumulada(tt: pd.DataFrame, empleo: pd.Series, umbral: float) -> pd.Series:
    """Matriz de tiempos de r5py (from_id, to_id, travel_time en min) -> empleos alcanzables en `umbral` min por
    origen. Un destino sin ruta (NaN) no cuenta."""
    alc = tt[tt.travel_time <= umbral]
    a = (alc.to_id.map(empleo).fillna(0.0)).groupby(alc.from_id).sum()
    return a.reindex(tt.from_id.unique(), fill_value=0.0).astype(float)
