"""Trayectorias sintéticas de velocidad conocida para validar `nucleo.recorridos` con reportes cada ~52 s."""

from dataclasses import dataclass
from types import SimpleNamespace

import numpy as np
import pandas as pd

from tm import nucleo


@dataclass
class Perfil:
    largo: float = 10_000.0              # m
    crucero: float = 8.0                 # m/s entre paradas
    cada_parada: float = 400.0           # m
    parada_s: tuple | float = (30, 60)   # s detenido en cada parada (rango uniforme o fijo)
    lento: tuple = ((2000, 2600, 2.0), (6000, 6500, 2.0))  # (desde, hasta, m/s): trancones


def reloj(p: Perfil, rng=None):
    """(s, t) del bus a lo largo de la ruta, con metro de resolución. Cada parada agrega un escalón en t."""
    rng = rng or np.random.default_rng(0)
    s = np.arange(0.0, p.largo + 1)
    v = np.full_like(s, p.crucero)
    for a, b, vl in p.lento:
        v[(s >= a) & (s < b)] = vl
    t = np.concatenate([[0.0], np.cumsum(1.0 / v[:-1])])
    paradas = np.arange(p.cada_parada, p.largo, p.cada_parada)
    lo, hi = p.parada_s if isinstance(p.parada_s, tuple) else (p.parada_s, p.parada_s)
    espera = rng.uniform(lo, hi, len(paradas))
    for x, w in zip(paradas, espera):
        t[s > x] += w
    # El bus llega a la parada en t(x) y sale en t(x)+w: dos puntos con la misma s para interpolar el escalón.
    i = np.searchsorted(s, paradas)
    s2 = np.insert(s, i + 1, paradas)
    t2 = np.insert(t, i + 1, t[i] + espera)
    return s2, t2


def tramos_reales(p: Perfil, rng=None) -> np.ndarray:
    s, t = reloj(p, rng)
    fronteras = np.arange(0, p.largo + 1, nucleo.TRAMO)
    # El bus "cruza" una frontera al salir de ella: el último instante con esa s (si hay parada justo ahí, la salida).
    return np.diff(t[np.searchsorted(s, fronteras, side="right") - 1])


def reportes(p: Perfil, rng, cada=52.0, ruido=10.0) -> pd.DataFrame:
    """Reportes cada `cada` s con fase al azar y ±`ruido` m de error de GPS a lo largo de la ruta."""
    s, t = reloj(p, rng)
    tt = np.arange(rng.uniform(0, cada), t[-1], cada)
    ss = np.interp(tt, t, s) + rng.uniform(-ruido, ruido, len(tt))
    return pd.DataFrame({"dia": "2026-11-23", "vehicle_id": "V", "route_id": "R", "ts": 1795410000 + tt, "s": ss})


def errores(semillas, p: Perfil | None = None, cada=52.0) -> SimpleNamespace:
    """Error relativo del tiempo por tramo medido frente al real, sobre varias trayectorias."""
    p = p or Perfil()
    med, real = [], []
    for k in semillas:
        # La misma semilla en los dos: las esperas en parada salen iguales, así la verdad y los reportes son el mismo bus.
        verdad = tramos_reales(p, np.random.default_rng(k))
        r = nucleo.recorridos(reportes(p, np.random.default_rng(k), cada=cada))
        r = r[r.tramo < len(verdad)]
        med.append(r.dur_s.to_numpy())
        real.append(verdad[r.tramo.to_numpy()])
    med, real = np.concatenate(med), np.concatenate(real)
    rel = (med - real) / real
    return SimpleNamespace(n=len(rel), sesgo_rel=med.sum() / real.sum() - 1, mediana_abs_rel=float(np.median(np.abs(rel))),
                           p90_abs_rel=float(np.quantile(np.abs(rel), 0.9)), real_s=float(np.median(real)))
