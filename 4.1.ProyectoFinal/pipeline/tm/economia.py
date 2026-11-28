"""Cuánto vale el retraso y dónde invertir primero (proyecto 1 visto como optimización)."""

import numpy as np
import pandas as pd

from tm.nucleo import CELDA


def celdas(t: pd.DataFrame, dias: int) -> pd.DataFrame:
    """Tramos de día hábil (n recorridos en `dias` días, t_ff en s, retraso_h por día) -> por celda de CELDA m:
    bus-horas por día dentro de la celda (tiempo libre + retraso) y retraso, de mayor a menor retraso."""
    t = t.assign(cx=(t.x // CELDA).astype(np.int64), cy=(t.y // CELDA).astype(np.int64),
                 libre_h=t.n / dias * t.t_ff / 3600)
    c = t.groupby(["cx", "cy"]).agg(libre_h=("libre_h", "sum"), retraso_h=("retraso_h", "sum"),
                                    x=("x", "mean"), y=("y", "mean")).reset_index()
    return c.assign(bus_h=c.libre_h + c.retraso_h).sort_values("retraso_h", ascending=False, ignore_index=True)


def curva(c: pd.DataFrame, efecto: float) -> pd.DataFrame:
    """Mochila con costos iguales: cada celda cuesta lo mismo (CELDA m de carril), así que el óptimo para cualquier
    presupuesto es tratar las celdas en orden de ahorro. Un carril que sube la velocidad en `efecto` ahorra
    bus_h · efecto / (1 + efecto), sin bajar del flujo libre.
    ponytail: celdas sueltas; un carril real es un corredor continuo, agrupar celdas si se usa para diseñar."""
    ahorro = np.minimum(c.bus_h * efecto / (1 + efecto), c.retraso_h)
    k = c.assign(ahorro_h=ahorro).sort_values("ahorro_h", ascending=False, ignore_index=True)
    return k.assign(km=(k.index + 1) * CELDA / 1000, ahorro_acum_h=k.ahorro_h.cumsum())
