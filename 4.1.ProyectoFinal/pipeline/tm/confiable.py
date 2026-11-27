"""Proyecto 2: tiempo de viaje confiable entre paradas.

El mismo cálculo de pares sirve para lo observado (pasadas reconstruidas de las posiciones) y para lo programado
(stop_times del GTFS): así la holgura del horario se compara contra lo medido, parada a parada.
"""

import io
import zipfile

import numpy as np
import pandas as pd
import pyarrow.csv as pc

from tm import nucleo

ZONAL_KM = 5000.0      # m: en rutas zonales (50-100 paradas) se mide el viaje a 5 km desde cada parada
PRUEBA = 0.4           # fracción final de días hábiles apartada para el walk-forward
MIN_N = 5              # observaciones mínimas por grupo para dar percentiles
EXCLUSIVO = {"troncal", "dual"}
DESVIO = 2.0           # distancia por la ruta / distancia en línea recta: más que esto, el par da la vuelta


def paradas(gtfs_zip: str, geos: dict) -> pd.DataFrame:
    """Paradas de cada ruta en orden, con su posición s sobre el shape. Se toma el viaje con más paradas de la ruta y
    se proyectan sus paradas con nucleo.emparejar: el orden de las paradas da el sentido de marcha.
    (shape_dist_traveled del GTFS no sirve: en las primeras paradas trae un valor fijo con la secuencia en decimales.)"""
    z = zipfile.ZipFile(gtfs_zip)
    st = leer_stop_times(z, ["trip_id", "stop_id", "stop_sequence"])
    st["route_id"] = st.trip_id.str.rsplit(".", n=1).str[-1]
    largo = st.groupby("trip_id").size()
    rep = largo.groupby(st.drop_duplicates("trip_id").set_index("trip_id").route_id.reindex(largo.index)).idxmax()
    st = st[st.trip_id.isin(set(rep))].sort_values(["route_id", "stop_sequence"])
    stops = pd.read_csv(io.BytesIO(z.read("stops.txt")), dtype={"stop_id": str}).set_index("stop_id")
    sal = []
    for r, g in st.groupby("route_id"):
        if r not in geos:
            continue
        xy = nucleo.a_metros(stops.stop_lon.reindex(g.stop_id).to_numpy(), stops.stop_lat.reindex(g.stop_id).to_numpy())
        s = nucleo.emparejar(xy, geos[r])[0]
        ok = ~np.isnan(s)
        ok[ok] &= s[ok] >= np.maximum.accumulate(s[ok])  # descarta paradas que retroceden sobre la ruta
        sal.append(pd.DataFrame({"route_id": r, "stop_id": g.stop_id.to_numpy()[ok], "s": s[ok],
                                 "x": xy[ok, 0], "y": xy[ok, 1]}))
    p = pd.concat(sal, ignore_index=True)
    p["orden"] = p.groupby("route_id").cumcount()
    p["nombre"] = p.stop_id.map(stops.stop_name)
    return p


def leer_stop_times(z: zipfile.ZipFile, columnas: list) -> pd.DataFrame:
    tipos = {c: "string" for c in ("trip_id", "stop_id", "arrival_time")}
    return pc.read_csv(io.BytesIO(z.read("stop_times.txt")),
                       convert_options=pc.ConvertOptions(include_columns=columnas, column_types=tipos)).to_pandas()


def en_paradas(rec: pd.DataFrame, par: pd.DataFrame) -> pd.DataFrame:
    """Recorridos de tramo -> momento en que cada pasada pasó por cada parada de su ruta. Se interpola entre las dos
    fronteras de tramo que rodean la parada, solo si el tramo que la contiene fue recorrido."""
    sal = []
    par = {r: g.sort_values("orden") for r, g in par.groupby("route_id")}
    for (dia, vid, pas, r), g in rec.groupby(["dia", "vehicle_id", "pasada", "route_id"], sort=False):
        if r not in par:
            continue
        g = g.sort_values("tramo")
        p = par[r]
        k = (p.s.to_numpy() // nucleo.TRAMO).astype(np.int64)
        i = pd.Series(np.arange(len(g)), index=g.tramo.to_numpy()).reindex(k)
        ok = i.notna().to_numpy()
        j = i.to_numpy()[ok].astype(np.int64)
        f = (p.s.to_numpy()[ok] - k[ok] * nucleo.TRAMO) / nucleo.TRAMO
        t = g.t_ini.to_numpy()[j] + f * g.dur_s.to_numpy()[j]
        fila = {"unidad": f"{vid}|{pas}", "route_id": r, "dia": dia, "stop_id": p.stop_id.to_numpy()[ok],
                "orden": p.orden.to_numpy()[ok], "s": p.s.to_numpy()[ok], "t": t}
        if "x" in p:
            fila |= {"x": p.x.to_numpy()[ok], "y": p.y.to_numpy()[ok]}
        sal.append(pd.DataFrame(fila))
    cols = ["unidad", "route_id", "dia", "stop_id", "orden", "s", "t"]
    return pd.concat(sal, ignore_index=True) if sal else pd.DataFrame(columns=cols)


def programado(st: pd.DataFrame, par: pd.DataFrame, t_ref: int) -> pd.DataFrame:
    """stop_times -> mismo formato que en_paradas, con t = t_ref + segundos desde la medianoche del día de servicio
    (el GTFS permite horas mayores a 24)."""
    st = st.assign(route_id=st.trip_id.str.rsplit(".", n=1).str[-1])
    hms = st.arrival_time.str.split(":", expand=True).astype(np.int64)
    st["t"] = t_ref + hms[0] * 3600 + hms[1] * 60 + hms[2]
    xy = [c for c in ("x", "y") if c in par]
    m = st.merge(par[["route_id", "stop_id", "orden", "s"] + xy], on=["route_id", "stop_id"])
    return pd.DataFrame({"unidad": m.trip_id, "route_id": m.route_id, "dia": "programado", "stop_id": m.stop_id,
                         "orden": m.orden, "s": m.s, "t": m.t.astype(float), **{c: m[c] for c in xy}})


def pares(tp: pd.DataFrame, sistemas: dict) -> pd.DataFrame:
    """Tiempos en paradas -> viajes entre pares de paradas de la misma pasada. Troncal y dual: todas las parejas de
    estaciones (son pocas). Zonal y alimentador: desde cada parada, la primera a ZONAL_KM o más. Se descartan los pares
    que dan la vuelta: más de DESVIO veces la distancia en línea recta (+500 m), un viaje que nadie haría en ese bus."""
    sal = []
    for (u, r, dia), g in tp.groupby(["unidad", "route_id", "dia"], sort=False):
        g = g.sort_values("orden")
        s, t, sid = g.s.to_numpy(), g.t.to_numpy(), g.stop_id.to_numpy()
        if sistemas.get(r) in EXCLUSIVO:
            i, j = np.triu_indices(len(g), 1)
        else:
            j = np.searchsorted(s, s + ZONAL_KM)
            i = np.flatnonzero(j < len(g))
            j = j[i]
        if "x" in g:
            x, y = g.x.to_numpy(), g.y.to_numpy()
            recta = np.hypot(x[j] - x[i], y[j] - y[i])
            ok = s[j] - s[i] <= DESVIO * recta + 500
            i, j = i[ok], j[ok]
        sal.append(pd.DataFrame({"route_id": r, "origen": sid[i], "destino": sid[j], "dia": dia,
                                 "t_salida": t[i], "dur_s": t[j] - t[i]}))
    cols = ["route_id", "origen", "destino", "dia", "t_salida", "dur_s"]
    v = pd.concat(sal, ignore_index=True) if sal else pd.DataFrame(columns=cols)
    return v[v.dur_s > 0]


def confiabilidad(v: pd.DataFrame) -> tuple:
    """Viajes observados -> (estadísticas por (ruta, origen, destino, tipo de día, hora), walk-forward).
    p50, p95, media, BTI = (p95 − media)/media, PTI = p95 / flujo libre (p5 del par en todo el periodo)."""
    v = v.assign(hora=((v.t_salida.astype(np.int64) + nucleo.BOG) // 3600) % 24, tipo_dia=v.dia.map(nucleo.tipo_dia))
    llave = ["route_id", "origen", "destino"]
    ff = v.groupby(llave).dur_s.quantile(0.05).rename("t_ff")
    g = v.groupby(llave + ["tipo_dia", "hora"]).dur_s
    c = g.agg(n="size", media="mean")
    c[["p50", "p80", "p95"]] = g.quantile([0.5, 0.8, 0.95]).unstack().to_numpy()
    c = c[c.n >= MIN_N].reset_index().join(ff, on=llave)
    c["bti"] = (c.p95 - c.media) / c.media
    c["pti"] = c.p95 / c.t_ff
    return c, walkforward(v)


def walkforward(v: pd.DataFrame) -> dict:
    """p95 con los primeros días hábiles; cobertura = fracción de los viajes de los días restantes que llega dentro
    de ese colchón. Si el colchón sirve para planear, la cobertura queda cerca de 0,95."""
    hab = v[v.tipo_dia == "laboral"]
    dias = sorted(hab.dia.unique())
    corte = len(dias) - max(1, round(len(dias) * PRUEBA))
    llave = ["route_id", "origen", "destino", "hora"]
    ent, pru = hab[hab.dia.isin(dias[:corte])], hab[hab.dia.isin(dias[corte:])]
    g = ent.groupby(llave).dur_s
    p95 = g.quantile(0.95)[g.size() >= MIN_N].rename("p95")
    pru = pru.join(p95, on=llave, how="inner")
    dentro = pru.dur_s <= pru.p95
    por_hora = dentro.groupby(pru.hora).agg(["size", "sum"])
    return {"dias_entrena": dias[:corte], "dias_prueba": dias[corte:], "viajes_prueba": int(len(pru)),
            "dentro": int(dentro.sum()), "cobertura": round(float(dentro.mean()), 4) if len(pru) else None,
            "por_hora": {int(h): [int(n), int(d)] for h, (n, d) in por_hora.iterrows()}}


def juntar_walkforward(partes: list) -> dict:
    """Walk-forward de varios cubos -> uno solo (suma de viajes y de aciertos)."""
    partes = [p for p in partes if p["viajes_prueba"]]
    n, d = sum(p["viajes_prueba"] for p in partes), sum(p["dentro"] for p in partes)
    hora = {}
    for p in partes:
        for h, (nh, dh) in p["por_hora"].items():
            hora.setdefault(h, [0, 0])
            hora[h][0] += nh
            hora[h][1] += dh
    return {"dias_entrena": partes[0]["dias_entrena"] if partes else [], "dias_prueba": partes[0]["dias_prueba"] if partes else [],
            "viajes_prueba": n, "cobertura": round(d / n, 4) if n else None,
            "cobertura_por_hora": {h: round(dh / nh, 3) for h, (nh, dh) in sorted(hora.items())}}


# ---------------------------------------------------------------- unidades de trabajo (una tarea de Ray por cubo)
T_REF = 1795410000  # una medianoche de Bogotá: el horario solo se compara por hora del día
HORARIO = ["trip_id", "stop_id", "stop_sequence", "arrival_time"]


def repartir_horario(gtfs_zip: str, salida: str) -> int:
    """stop_times.txt (559 MB, 9 M filas) -> Parquet por cubo de rutas, una sola vez: cada tarea lee solo el suyo."""
    st = leer_stop_times(zipfile.ZipFile(gtfs_zip), HORARIO)
    st["cubo"] = st.trip_id.str.rsplit(".", n=1).str[-1].map(nucleo.cubo)
    import pyarrow as pa
    import pyarrow.parquet as pq
    pq.write_to_dataset(pa.Table.from_pandas(st, preserve_index=False), salida, partition_cols=["cubo"])
    return len(st)


def cubo(entradas: list, horario: str, salida: str, par: pd.DataFrame, sistemas: dict) -> dict:
    """Recorridos de un cubo de rutas (todos los días) -> estadísticas de confiabilidad con la holgura del horario,
    escritas en `salida`; devuelve el walk-forward del cubo."""
    from pathlib import Path
    rec = pd.concat([pd.read_parquet(e) for e in entradas], ignore_index=True)
    par = par[par.route_id.isin(set(rec.route_id))]
    v = pares(en_paradas(rec, par), sistemas)
    if v.empty:
        return juntar_walkforward([])
    c, wf = confiabilidad(v)
    hp = Path(horario)
    if hp.exists():
        st = pd.read_parquet(hp, columns=HORARIO)
        vp = pares(programado(st, par, T_REF), sistemas)
        vp = vp.assign(hora=((vp.t_salida.astype(np.int64) + nucleo.BOG) // 3600) % 24)
        prog = vp.groupby(["route_id", "origen", "destino", "hora"]).dur_s.median().rename("programado_p50")
        c = c.join(prog, on=["route_id", "origen", "destino", "hora"])
    else:
        c["programado_p50"] = np.nan
    Path(salida).parent.mkdir(parents=True, exist_ok=True)
    c.to_parquet(salida, index=False)
    return wf
