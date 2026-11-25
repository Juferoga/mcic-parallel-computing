"""Funciones puras del pipeline. Las usan igual la versión secuencial y la de Ray, así el benchmark compara
el mismo trabajo y solo cambia cómo se reparte."""

import gzip
import io
import zipfile
import zlib
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from google.transit import gtfs_realtime_pb2

FRESCO = 300            # s: reporte más viejo que esto respecto a la captura = zombi
BOG = -5 * 3600         # UTC-5, sin horario de verano
MAX_DESVIO = 120.0      # m: más lejos de la geometría de su ruta = no se empareja
TRAMO = 500.0           # m: largo de un tramo para agregar velocidades
PARTES = 64             # particiones por día: hash(vehicle_id) % PARTES (el shuffle se hace al escribir)
COLUMNAS = ["dia", "parte", "captura", "ts", "vehicle_id", "trip_id", "route_id", "stop_id", "lat", "lon"]


# ---------------------------------------------------------------- etapa 1: protobuf -> filas
def parsear(contenido: bytes) -> dict:
    """Una captura .pb.gz -> columnas. Descarta reportes con más de 5 min de antigüedad (zombis)."""
    f = gtfs_realtime_pb2.FeedMessage()
    try:
        # Ray Data ya descomprime los .gz al leerlos; el modo secuencial entrega los bytes comprimidos.
        f.ParseFromString(gzip.decompress(contenido) if contenido[:2] == b"\x1f\x8b" else contenido)
    except Exception:
        # Captura dañada (truncada o corrupta): se descarta. Ambos modos la tratan igual.
        f = gtfs_realtime_pb2.FeedMessage()
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


def cargar_geometrias(gtfs_zip: str) -> dict:
    """route_id -> (puntos en metros (m,2), distancia acumulada (m,)). Una geometría por ruta: la más usada."""
    z = zipfile.ZipFile(gtfs_zip)
    viajes = pd.read_csv(io.BytesIO(z.read("trips.txt")), dtype=str, usecols=["route_id", "shape_id"])
    forma = viajes.groupby("route_id").shape_id.agg(lambda s: s.mode().iloc[0])
    sh = pd.read_csv(io.BytesIO(z.read("shapes.txt")), dtype={"shape_id": str})
    sh = sh[sh.shape_id.isin(set(forma))].sort_values(["shape_id", "shape_pt_sequence"])
    geos = {}
    por_forma = {sid: g for sid, g in sh.groupby("shape_id")}
    for rid, sid in forma.items():
        g = por_forma.get(sid)
        if g is None or len(g) < 2:
            continue
        p = a_metros(g.shape_pt_lon.to_numpy(), g.shape_pt_lat.to_numpy())
        acum = np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))])
        geos[rid] = (p, acum)
    return geos


def proyectar(p: np.ndarray, geo) -> tuple:
    """Map-matching: cada punto (n,2) a su segmento más cercano de la polilínea. Devuelve (s, desvío) en metros.
    Es O(n·m): el kernel caro del pipeline."""
    q, acum = geo
    a, b = q[:-1], q[1:]
    ab = b - a
    L2 = np.maximum((ab ** 2).sum(1), 1e-9)
    ap = p[:, None, :] - a[None, :, :]                          # (n, m, 2)
    t = np.clip((ap * ab[None]).sum(2) / L2[None], 0.0, 1.0)     # (n, m)
    proy = a[None] + t[..., None] * ab[None]
    d2 = ((p[:, None, :] - proy) ** 2).sum(2)
    j = d2.argmin(1)
    i = np.arange(len(p))
    return acum[j] + t[i, j] * np.sqrt(L2[j]), np.sqrt(d2[i, j])


# ---------------------------------------------------------------- etapa 2: trayectoria de un bus en un día
SALIDA = {"dia": "str", "vehicle_id": "str", "route_id": "str", "stop_id": "str", "ts": "int64", "hora": "int64",
          "s": "float64", "desvio": "float64", "v_kmh": "float64", "dt": "float64", "tramo": "int64", "llegada": "bool"}


def trayectoria(df: pd.DataFrame, geos: dict) -> pd.DataFrame:
    """Película de un bus en un día: ordena, deduplica, empareja con su ruta y calcula velocidad y llegadas."""
    df = df.sort_values("ts").drop_duplicates("ts")
    if len(df) < 2:
        return pd.DataFrame({k: pd.Series(dtype=v) for k, v in SALIDA.items()})
    s = np.full(len(df), np.nan)
    desvio = np.full(len(df), np.nan)
    pts = a_metros(df.lon.to_numpy(), df.lat.to_numpy())
    rutas = df.route_id.to_numpy()
    for r in pd.unique(rutas):
        geo = geos.get(r)
        if geo is None:
            continue
        m = rutas == r
        for ini in range(0, m.sum(), 400):  # por bloques: acota la memoria de la matriz n×m
            idx = np.flatnonzero(m)[ini:ini + 400]
            s[idx], desvio[idx] = proyectar(pts[idx], geo)
    ok = desvio <= MAX_DESVIO
    ts = df.ts.to_numpy()
    dt = np.diff(ts).astype(float)
    ds = np.diff(s)
    misma = (rutas[1:] == rutas[:-1]) & (df.trip_id.to_numpy()[1:] == df.trip_id.to_numpy()[:-1])
    valida = misma & ok[1:] & ok[:-1] & (dt >= 15) & (dt <= 300) & (ds > -30)
    v = np.where(valida, np.clip(ds, 0, None) / np.maximum(dt, 1) * 3.6, np.nan)
    v = np.where(v > 90, np.nan, v)  # saltos imposibles
    paradas = df.stop_id.to_numpy()
    llegada = np.concatenate([[False], (paradas[1:] != paradas[:-1]) | ~misma])
    return pd.DataFrame({
        "dia": df.dia.to_numpy(), "vehicle_id": df.vehicle_id.to_numpy(), "route_id": rutas, "stop_id": paradas,
        "ts": ts, "hora": ((ts + BOG) // 3600) % 24, "s": s, "desvio": desvio,
        "v_kmh": np.concatenate([[np.nan], v]), "dt": np.concatenate([[np.nan], np.where(np.isnan(v), np.nan, dt)]),
        "tramo": np.where(np.isnan(s), -1, s // TRAMO).astype(np.int64),
        "llegada": llegada,
    })


# ---------------------------------------------------------------- etapa 3: headway en puntos de control
ESQ_CRUCES = pa.schema([("route_id", pa.string()), ("punto", pa.int64()), ("ts", pa.float64())])
ESQ_HEADWAYS = pa.schema([("dia", pa.string()), ("route_id", pa.string()), ("punto", pa.int64()),
                          ("hora", pa.int64()), ("headway_s", pa.float64())])


def escribir(df: pd.DataFrame, salida: str, esquema: pa.Schema):
    """Parquet con esquema fijo: una partición vacía no puede cambiar los tipos del conjunto."""
    Path(salida).parent.mkdir(parents=True, exist_ok=True)
    df = df.astype({c.name: ("str" if c.type == pa.string() else c.type.to_pandas_dtype()) for c in esquema})
    pq.write_table(pa.Table.from_pandas(df[esquema.names], schema=esquema, preserve_index=False), salida)

CONTROL = 1000.0  # m: un punto de control cada km sobre la ruta


def cruces(df: pd.DataFrame) -> pd.DataFrame:
    """Momentos en que cada bus cruza los puntos de control (k·1 km) de su ruta, interpolando entre reportes.
    No depende de stop_id, que el feed no actualizaba antes del 18 de noviembre."""
    sal = []
    for _, g in df.groupby("vehicle_id", sort=False):
        g = g.sort_values("ts")
        s, ts, r = g.s.to_numpy(), g.ts.to_numpy().astype(float), g.route_id.to_numpy()
        valida = ~np.isnan(g.v_kmh.to_numpy()[1:])  # mismo viaje, emparejado, Δt entre 15 y 300 s
        s1, s2, t1, t2 = s[:-1][valida], s[1:][valida], ts[:-1][valida], ts[1:][valida]
        ruta = r[1:][valida]
        avanza = s2 > s1
        s1, s2, t1, t2, ruta = s1[avanza], s2[avanza], t1[avanza], t2[avanza], ruta[avanza]
        k0 = np.floor(s1 / CONTROL).astype(np.int64) + 1
        n = np.maximum(np.floor(s2 / CONTROL).astype(np.int64) - k0 + 1, 0)
        if n.sum() == 0:
            continue
        i = np.repeat(np.arange(len(n)), n)
        k = k0[i] + (np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n))
        t = t1[i] + (k * CONTROL - s1[i]) / (s2[i] - s1[i]) * (t2[i] - t1[i])
        sal.append(pd.DataFrame({"route_id": ruta[i], "punto": k, "ts": t}))
    vacio = pd.DataFrame({"route_id": pd.Series(dtype=object), "punto": pd.Series(dtype="int64"), "ts": pd.Series(dtype="float64")})
    return pd.concat(sal, ignore_index=True) if sal else vacio


def headways(df: pd.DataFrame, dia: str) -> pd.DataFrame:
    """Cruces de un día -> intervalo entre buses consecutivos de la misma ruta en el mismo punto de control."""
    df = df.sort_values(["route_id", "punto", "ts"])
    misma = (df.route_id.to_numpy()[1:] == df.route_id.to_numpy()[:-1]) & (df.punto.to_numpy()[1:] == df.punto.to_numpy()[:-1])
    t = df.ts.to_numpy()
    h = np.diff(t)[misma]
    t2 = t[1:][misma]
    return pd.DataFrame({"dia": dia, "route_id": df.route_id.to_numpy()[1:][misma], "punto": df.punto.to_numpy()[1:][misma],
                         "hora": ((t2.astype(np.int64) + BOG) // 3600) % 24, "headway_s": h})


# ---------------------------------------------------------------- unidades de trabajo (una tarea cada una)
def particion_trayectorias(entrada: str, salida: str, geos: dict) -> int:
    """Una partición (día, parte): todos los reportes de ~1/64 de los buses de ese día."""
    df = pd.read_parquet(entrada)
    df["dia"] = Path(entrada).parent.name.split("=", 1)[1]
    res = [trayectoria(g, geos) for _, g in df.groupby("vehicle_id", sort=False)]
    res = pd.concat(res, ignore_index=True) if res else pd.DataFrame({k: pd.Series(dtype=v) for k, v in SALIDA.items()})
    Path(salida).parent.mkdir(parents=True, exist_ok=True)
    res.to_parquet(salida, index=False)
    return len(res)


def particion_cruces(entrada: str, salida: str) -> int:
    """Una partición de trayectorias -> cruces por los puntos de control."""
    df = pd.read_parquet(entrada, columns=["vehicle_id", "route_id", "ts", "s", "v_kmh"])
    res = cruces(df)
    escribir(res, salida, ESQ_CRUCES)
    return len(res)


def dia_headways(entradas: list, salida: str) -> int:
    """Todos los cruces de un día -> headways por ruta y punto de control."""
    dia = Path(entradas[0]).parent.name.split("=", 1)[1]
    partes = [pd.read_parquet(e) for e in entradas]
    df = pd.concat([p for p in partes if len(p)], ignore_index=True) if any(len(p) for p in partes) else partes[0]
    df["route_id"] = df.route_id.astype(str)
    res = headways(df, dia)
    escribir(res, salida, ESQ_HEADWAYS)
    return len(res)
