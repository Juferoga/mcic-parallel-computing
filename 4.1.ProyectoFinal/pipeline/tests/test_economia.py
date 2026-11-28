import pandas as pd
import pytest

from tm import economia


def test_celdas_suma_tiempo_libre_y_retraso_por_dia():
    # dos rutas en la misma celda de 250 m y una en otra; 2 días hábiles
    t = pd.DataFrame({"x": [10.0, 20.0, 600.0], "y": [10.0, 30.0, 10.0], "route_id": ["a", "b", "a"],
                      "n": [4, 2, 2], "t_ff": [360.0, 360.0, 720.0], "retraso_h": [0.5, 0.2, 1.0]})
    c = economia.celdas(t, dias=2)
    assert c.retraso_h.tolist() == pytest.approx([1.0, 0.7])
    # celda 1: (4 + 2) / 2 recorridos por día × 0,1 h libres + 0,7 h de retraso
    assert c.bus_h.tolist() == pytest.approx([2 / 2 * 0.2 + 1.0, 3 * 0.1 + 0.7])


def test_curva_ordena_por_ahorro_y_no_baja_del_flujo_libre():
    c = pd.DataFrame({"bus_h": [12.0, 3.0, 6.0], "retraso_h": [1.0, 2.0, 5.0]})
    k = economia.curva(c, efecto=0.2)  # +20 % de velocidad ahorra 1/6 del tiempo, sin pasar del retraso
    assert k.ahorro_h.tolist() == pytest.approx([1.0, 1.0, 0.5])
    assert k.km.tolist() == pytest.approx([0.25, 0.5, 0.75])
    assert k.ahorro_acum_h.tolist() == pytest.approx([1.0, 2.0, 2.5])
