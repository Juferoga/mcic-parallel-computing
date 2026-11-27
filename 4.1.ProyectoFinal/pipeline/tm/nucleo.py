"""Funciones puras del pipeline: las usan igual la versión secuencial y la de Ray.

La lectura del protobuf, el filtro de zombis y la proyección sobre la ruta vienen de 4.ProyectoFinal/pipeline/tm/nucleo.py.
Lo nuevo: el emparejamiento usa el sentido de marcha (rutas de ida y vuelta en un solo shape), el viaje se corta en
pasadas y se mide el tiempo de recorrido de cada tramo de 500 m.
"""

import gzip
import io
import zipfile
import zlib
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd
from google.transit import gtfs_realtime_pb2

FRESCO = 300            # s: reporte más viejo que esto respecto a la captura = zombi
BOG = -5 * 3600         # UTC-5, sin horario de verano
MAX_DESVIO = 120.0      # m: más lejos de su ruta = no se empareja
TRAMO = 500.0           # m: con un reporte cada ~52 s quedan 2-3 puntos por tramo; menos no se resuelve
MAX_HUECO = 300         # s: más tiempo sin reportes = otra pasada
MAX_RETROCESO = 200.0   # m: retroceder más = otra pasada (fin de la vuelta o reinicio de la ruta)
V_MAX = 25.0            # m/s (90 km/h): avanzar más rápido sobre la ruta = el emparejamiento saltó, otra pasada
QUIETO = 15.0           # m entre reportes: menos que esto (ruido de GPS incluido) = bus detenido
MAX_PARADA = 600        # s detenido: más que esto ya no es tráfico ni parada, es espera (otra pasada)
MIN_RUMBO = 20.0      # m: desplazamiento mínimo para confiar en el sentido de marcha
PARTES = 64             # particiones por día: crc32(vehicle_id) % PARTES
COLUMNAS = ["dia", "parte", "captura", "ts", "vehicle_id", "trip_id", "route_id", "stop_id", "lat", "lon"]
# ponytail: festivos del periodo archivado escritos a mano; ampliar si el archivo pasa de 2026.
FESTIVOS = {"2026-11-16", "2026-12-08", "2026-12-25"}


def es_del_dia(ruta: str, dia: str) -> bool:
    """¿La captura raw/AAAA/MM/DD/positions_<UTC>.pb.gz puede traer reportes del día de servicio `dia` (Bogotá)?
    Las carpetas están en UTC: el día de Bogotá D va de D 05:00 UTC a D+1 05:00 UTC."""
    nombre = Path(ruta).name
    if not nombre.startswith("positions_"):
        return False
    utc = nombre.split("_", 1)[1][:13]  # AAAAMMDDTHHMM
    d0 = date.fromisoformat(dia)
    d = date(int(utc[:4]), int(utc[4:6]), int(utc[6:8]))
    hhmm = utc[9:13]
    return (d == d0 and hhmm >= "0500") or ((d - d0).days == 1 and hhmm < "0500")


# ---------------------------------------------------------------- etapa 1: protobuf -> filas
def parsear(contenido: bytes) -> dict:
    """Una captura .pb.gz -> columnas. Descarta reportes con más de 5 min de antigüedad (zombis y congelamientos)."""
    f = gtfs_realtime_pb2.FeedMessage()
    try:
        # Ray Data ya descomprime los .gz al leerlos; el modo secuencial entrega los bytes comprimidos.
        f.ParseFromString(gzip.decompress(contenido) if contenido[:2] == b"\x1f\x8b" else contenido)
    except Exception:
        f = gtfs_realtime_pb2.FeedMessage()  # captura dañada: se descarta, igual en los dos modos
    cap = f.header.timestamp
    ts, vid, trip, ruta, parada, lat, lon = [], [], [], [], [], [], []
    for e in f.entity:
        v = e.vehicle
        if cap - v.timestamp >= FRESCO or not v.HasField("position"):
            continue
        ts.append(v.timestamp)
        vid.append(v.vehicle.id)
        trip.append(v.trip.trip_id)
        ruta.append(v.trip.route_id)
        parada.append(v.stop_id)
        lat.append(v.position.latitude)
        lon.append(v.position.longitude)
    ts = np.asarray(ts, dtype=np.int64)
    dia = pd.to_datetime(ts + BOG, unit="s").strftime("%Y-%m-%d").to_numpy(dtype=object) if len(ts) else np.array([], dtype=object)
    parte = np.fromiter((zlib.crc32(x.encode()) % PARTES for x in vid), dtype=np.int64, count=len(vid))
    return {"dia": dia, "parte": parte, "captura": np.full(len(ts), cap, dtype=np.int64), "ts": ts,
            "vehicle_id": np.asarray(vid, dtype=object), "trip_id": np.asarray(trip, dtype=object),
            "route_id": np.asarray(ruta, dtype=object), "stop_id": np.asarray(parada, dtype=object),
            "lat": np.asarray(lat, dtype=np.float64), "lon": np.asarray(lon, dtype=np.float64)}


def parsear_lote(lote: dict) -> dict:
    """map_batches: varios archivos -> una tabla."""
    partes = [parsear(b) for b in lote["bytes"]]
    return {k: np.concatenate([p[k] for p in partes]) for k in COLUMNAS}


# ---------------------------------------------------------------- geometrías (shapes.txt)
LAT0 = 4.65
KX, KY = 111_320.0 * np.cos(np.radians(LAT0)), 110_540.0


def a_metros(lon, lat):
    return np.column_stack([(np.asarray(lon) + 74.1) * KX, (np.asarray(lat) - LAT0) * KY])


def a_grados(p):
    return p[:, 0] / KX - 74.1, p[:, 1] / KY + LAT0


def geometria(p: np.ndarray):
    """Polilínea en metros (m,2) -> (puntos, distancia acumulada)."""
    return p, np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])


def cargar_geometrias(gtfs_zip: str) -> dict:
    """route_id -> geometria. En el GTFS de TransMilenio cada ruta tiene un solo shape (shape_id = route_id)."""
    z = zipfile.ZipFile(gtfs_zip)
    viajes = pd.read_csv(io.BytesIO(z.read("trips.txt")), dtype=str, usecols=["route_id", "shape_id"])
    forma = viajes.groupby("route_id").shape_id.agg(lambda s: s.mode().iloc[0])
    sh = pd.read_csv(io.BytesIO(z.read("shapes.txt")), dtype={"shape_id": str})
    sh = sh[sh.shape_id.isin(set(forma))].sort_values(["shape_id", "shape_pt_sequence"])
    por_forma = {sid: g for sid, g in sh.groupby("shape_id")}
    geos = {}
    for rid, sid in forma.items():
        g = por_forma.get(sid)
        if g is not None and len(g) >= 2:
            geos[rid] = geometria(a_metros(g.shape_pt_lon.to_numpy(), g.shape_pt_lat.to_numpy()))
    return geos


def punto(geo, s: np.ndarray) -> np.ndarray:
    """Coordenadas (en metros) del punto a distancia s sobre la ruta."""
    q, acum = geo
    return np.column_stack([np.interp(s, acum, q[:, 0]), np.interp(s, acum, q[:, 1])])


def cerca(xy: np.ndarray, vias: list, dist: float) -> np.ndarray:
    """¿Cada punto (n,2) queda a `dist` m o menos de alguna de las polilíneas (en metros)?"""
    sal = np.zeros(len(xy), dtype=bool)
    for q in vias:
        a, ab = q[:-1], np.diff(q, axis=0)
        L2 = np.maximum((ab ** 2).sum(1), 1e-9)
        ap = xy[:, None, :] - a[None]
        t = np.clip((ap * ab[None]).sum(2) / L2, 0, 1)
        sal |= (((ap - t[..., None] * ab[None]) ** 2).sum(2) <= dist ** 2).any(1)
    return sal


CELDA = 250.0  # m: tramos de rutas distintas cuyo centro cae en la misma celda son la misma calle


def celdas(t: pd.DataFrame) -> pd.DataFrame:
    """Tramos con centro (x, y) y retraso_h -> ranking por celda de CELDA m: suma de bus-horas de todas las rutas que
    pasan por ahí. ponytail: celda cuadrada fija; un tramo en el borde se parte entre dos celdas vecinas."""
    t = t.assign(cx=(t.x // CELDA).astype(np.int64), cy=(t.y // CELDA).astype(np.int64))
    c = t.groupby(["cx", "cy"]).agg(retraso_h=("retraso_h", "sum"), rutas=("route_id", "nunique"),
                                    x=("x", "mean"), y=("y", "mean")).reset_index()
    return c.sort_values("retraso_h", ascending=False, ignore_index=True)


def sistemas(gtfs_zip: str) -> dict:
    """route_id -> troncal | alimentador | dual | zonal | cable (por agency_id del GTFS)."""
    nombre = {"1": "troncal", "2": "alimentador", "6": "dual", "3": "zonal", "4": "zonal", "5": "zonal", "7": "cable"}
    r = pd.read_csv(io.BytesIO(zipfile.ZipFile(gtfs_zip).read("routes.txt")), dtype=str)
    return dict(zip(r.route_id, r.agency_id.map(nombre)))


# ---------------------------------------------------------------- etapa 2: emparejar, pasadas, recorridos por tramo
def rumbo(p: np.ndarray) -> np.ndarray:
    """Vector de marcha de cada punto (diferencia centrada). Si el bus está quieto, hereda el del último punto en
    movimiento (o el del siguiente, al inicio). Fila de ceros si nunca se movió."""
    if len(p) < 2:
        return np.zeros_like(p)
    u = np.empty_like(p)
    u[1:-1] = p[2:] - p[:-2]
    u[0], u[-1] = p[1] - p[0], p[-1] - p[-2]
    quieto = np.hypot(*u.T) < MIN_RUMBO
    u[quieto] = np.nan
    return pd.DataFrame(u).ffill().bfill().fillna(0.0).to_numpy()


def emparejar(p: np.ndarray, geo) -> tuple:
    """Map-matching de puntos consecutivos de un bus (n,2) sobre su ruta. Devuelve (s, desvío) en metros; s es NaN
    si el punto queda a más de MAX_DESVIO. Solo cuentan los segmentos que van en el sentido de marcha del bus: así
    una ruta de ida y vuelta por la misma calle no confunde la ida con la vuelta. Costo O(n·m): el kernel caro.
    ponytail: el sentido no separa un shape que pasa dos veces por la misma calle en el mismo sentido; si aparece,
    el siguiente paso es un HMM (Viterbi) con continuidad de s."""
    q, acum = geo
    a, ab = q[:-1], np.diff(q, axis=0)
    L2 = np.maximum((ab ** 2).sum(1), 1e-9)
    u = rumbo(p)
    con_rumbo = np.hypot(*u.T) > 0
    s, desvio = np.full(len(p), np.nan), np.full(len(p), np.inf)
    for i0 in range(0, len(p), 400):  # por bloques: acota la memoria de la matriz n×m
        sl = slice(i0, i0 + 400)
        ap = p[sl, None, :] - a[None]
        t = np.clip((ap * ab[None]).sum(2) / L2, 0.0, 1.0)
        d2 = ((ap - t[..., None] * ab[None]) ** 2).sum(2)
        contra = ((u[sl] @ ab.T) <= 0) & con_rumbo[sl, None]
        d2 = np.where(contra, np.inf, d2)
        j = d2.argmin(1)
        k = np.arange(len(j))
        desvio[sl] = np.sqrt(d2[k, j])
        s[sl] = acum[j] + t[k, j] * np.sqrt(L2[j])
    s[desvio > MAX_DESVIO] = np.nan
    return s, desvio


def pasadas(ts: np.ndarray, s: np.ndarray, ruta: np.ndarray) -> np.ndarray:
    """Número de pasada de cada punto (ordenados por tiempo, sin NaN). Una pasada nueva empieza si cambia la ruta,
    si hay un hueco de más de MAX_HUECO, si el bus retrocede más de MAX_RETROCESO sobre la ruta o si avanza más
    rápido que V_MAX (el emparejamiento saltó a otra parte del shape)."""
    nueva = np.ones(len(ts), dtype=bool)
    dt, ds = np.diff(ts), np.diff(s)
    nueva[1:] = (ruta[1:] != ruta[:-1]) | (dt > MAX_HUECO) | (ds < -MAX_RETROCESO) | (ds > V_MAX * np.maximum(dt, 1))
    # Espera larga (terminal a mitad de un shape de ida y vuelta, o bus estacionado): más de MAX_PARADA sin avanzar
    # QUIETO m entre reportes. La pasada se corta al final de la espera, así el tramo que la contiene no se mide.
    q = np.concatenate([[0], (np.abs(ds) < QUIETO).astype(np.int8), [0]])
    ini, fin = np.flatnonzero(np.diff(q) == 1), np.flatnonzero(np.diff(q) == -1) - 1
    largas = ts[fin + 1] - ts[ini] > MAX_PARADA
    nueva[fin[largas] + 1] = True
    return np.cumsum(nueva) - 1


RECORRIDOS = {"dia": "object", "vehicle_id": "object", "route_id": "object", "pasada": "int64", "tramo": "int64",
              "t_ini": "float64", "dur_s": "float64"}


def vacio(esquema: dict) -> pd.DataFrame:
    return pd.DataFrame({k: pd.Series(dtype=v) for k, v in esquema.items()})


def recorridos(df: pd.DataFrame) -> pd.DataFrame:
    """Puntos emparejados (dia, vehicle_id, route_id, ts, s) -> un registro por tramo de TRAMO m recorrido completo:
    cuándo entró (t_ini) y cuánto tardó (dur_s). Los cruces de cada frontera k·TRAMO se interpolan entre los dos
    reportes que la rodean."""
    sal = []
    for (dia, vid), g in df.dropna(subset=["s"]).groupby(["dia", "vehicle_id"], sort=False):
        g = g.sort_values("ts").drop_duplicates("ts")
        ts, s, r = g.ts.to_numpy().astype(float), g.s.to_numpy(), g.route_id.to_numpy()
        pas = pasadas(ts, s, r)
        par = (pas[1:] == pas[:-1]) & (s[1:] > s[:-1])
        s1, s2, t1, t2, pp, rr = s[:-1][par], s[1:][par], ts[:-1][par], ts[1:][par], pas[1:][par], r[1:][par]
        k0 = np.ceil(s1 / TRAMO).astype(np.int64)             # fronteras k·TRAMO en [s1, s2)
        n = np.maximum(np.ceil(s2 / TRAMO).astype(np.int64) - k0, 0)
        if n.sum() == 0:
            continue
        i = np.repeat(np.arange(len(n)), n)
        k = k0[i] + (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n))
        t = t1[i] + (k * TRAMO - s1[i]) / (s2[i] - s1[i]) * (t2[i] - t1[i])
        p, ruta = pp[i], rr[i]
        sig = (p[1:] == p[:-1]) & (k[1:] == k[:-1] + 1)        # cruce k seguido del k+1 en la misma pasada
        sal.append(pd.DataFrame({"dia": dia, "vehicle_id": vid, "route_id": ruta[:-1][sig], "pasada": p[:-1][sig],
                                 "tramo": k[:-1][sig], "t_ini": t[:-1][sig], "dur_s": np.diff(t)[sig]}))
    return pd.concat(sal, ignore_index=True).astype(RECORRIDOS) if sal else vacio(RECORRIDOS)


def recorridos_bus(g: pd.DataFrame, geos: dict) -> pd.DataFrame:
    """Reportes de un bus en un día -> recorridos. Empareja cada ruta por separado, en orden de tiempo."""
    g = g.sort_values("ts").drop_duplicates("ts")
    s = np.full(len(g), np.nan)
    pts = a_metros(g.lon.to_numpy(), g.lat.to_numpy())
    rutas = g.route_id.to_numpy()
    for r in pd.unique(rutas):
        if r in geos:
            m = rutas == r
            s[m] = emparejar(pts[m], geos[r])[0]
    return recorridos(g.assign(s=s))


CUBOS = 32  # la salida se reparte por crc32(route_id) % CUBOS: la etapa 3 agrupa por ruta sin otro shuffle


def cubo(route_id: str) -> int:
    return zlib.crc32(route_id.encode()) % CUBOS


def particion(entrada: str, salida: str, geos: dict) -> int:
    """Unidad de trabajo de Ray: una carpeta dia=*/parte=* (~1/64 de los buses de un día) -> recorridos, escritos en
    salida/cubo=k/<dia>_<parte>.parquet."""
    df = pd.read_parquet(entrada, columns=["ts", "vehicle_id", "route_id", "lat", "lon"])
    dia, parte = Path(entrada).parent.name.split("=", 1)[1], Path(entrada).name.split("=", 1)[1]
    df["dia"] = dia
    res = [recorridos_bus(g, geos) for _, g in df.groupby("vehicle_id", sort=False)]
    res = pd.concat(res, ignore_index=True).astype(RECORRIDOS) if res else vacio(RECORRIDOS)
    for k, g in res.groupby(res.route_id.map(cubo)):
        d = Path(salida) / f"cubo={k}"
        d.mkdir(parents=True, exist_ok=True)
        g.to_parquet(d / f"{dia}_{parte}.parquet", index=False)
    return len(res)


def cubo_tramos(entradas: list, salida: str) -> int:
    """Unidad de trabajo de Ray en la etapa 3: todos los recorridos de un cubo de rutas -> velocidad y retraso por
    hora (salida) y retraso por día (al lado, en tramos_dia/)."""
    rec = pd.concat([pd.read_parquet(e) for e in entradas], ignore_index=True)
    res = agregar(rec)
    salida = Path(salida)
    por_dia = salida.parent.parent / "tramos_dia" / salida.name
    for p in (salida, por_dia):
        p.parent.mkdir(parents=True, exist_ok=True)
    res.to_parquet(salida, index=False)
    retraso_por_dia(rec).to_parquet(por_dia, index=False)
    return len(res)


# ---------------------------------------------------------------- etapa 3: velocidad y retraso por tramo y hora
def tipo_dia(dia: str) -> str:
    d = date.fromisoformat(dia)
    if dia in FESTIVOS or d.weekday() == 6:
        return "domingo_festivo"
    return "sabado" if d.weekday() == 5 else "laboral"


def con_retraso(rec: pd.DataFrame) -> pd.DataFrame:
    """Agrega hora, tipo de día, velocidad y retraso de cada recorrido frente al flujo libre de su tramo: el p5 de su
    duración en todo el periodo, como Aemmer et al. 2022."""
    rec = rec.assign(hora=((rec.t_ini.astype(np.int64) + BOG) // 3600) % 24, tipo_dia=rec.dia.map(tipo_dia),
                     v=TRAMO / rec.dur_s * 3.6)
    ff = rec.groupby(["route_id", "tramo"]).dur_s.quantile(0.05).rename("t_ff")
    rec = rec.join(ff, on=["route_id", "tramo"])
    rec["retraso_s"] = (rec.dur_s - rec.t_ff).clip(lower=0)
    return rec


def retraso_por_dia(rec: pd.DataFrame) -> pd.DataFrame:
    """Bus-horas de retraso por (ruta, tramo, día): la base de la estabilidad entre semanas y del bootstrap por día."""
    r = con_retraso(rec).groupby(["route_id", "tramo", "dia"], as_index=False).retraso_s.sum()
    return r.assign(retraso_h=r.retraso_s / 3600).drop(columns="retraso_s")


def agregar(rec: pd.DataFrame) -> pd.DataFrame:
    """Recorridos -> por (ruta, tramo, tipo de día, hora): n, velocidad p20/p50/p80 (km/h) y retraso en bus-horas por
    día frente al flujo libre del tramo."""
    rec = con_retraso(rec)
    dias = rec.groupby("tipo_dia").dia.nunique()
    g = rec.groupby(["route_id", "tramo", "tipo_dia", "hora"])
    q = g.v.quantile([0.2, 0.5, 0.8]).unstack()  # vectorizado: una lambda por grupo tardaba 100× más
    out = g.agg(n=("v", "size"), retraso_s=("retraso_s", "sum"), t_ff=("t_ff", "first"))
    out[["v_p20", "v_p50", "v_p80"]] = q.to_numpy()
    out = out.reset_index()
    out["retraso_h"] = out.retraso_s / 3600 / out.tipo_dia.map(dias)
    return out.drop(columns="retraso_s")
