import numpy as np
import pandas as pd

from tm import confiable, nucleo

T0 = 1795410000  # 2026-11-23 00:00 Bogotá


def rec_pasada(tramos, durs, t0=T0 + 7 * 3600, dia="2026-11-23", pasada=0, vid="V1", ruta="R"):
    """Recorridos consecutivos de una pasada: tramo k entra en t y tarda d."""
    t = t0 + np.concatenate([[0], np.cumsum(durs)[:-1]])
    return pd.DataFrame({"dia": dia, "vehicle_id": vid, "route_id": ruta, "pasada": pasada, "tramo": tramos,
                         "t_ini": t, "dur_s": durs})


def test_en_paradas_interpola_sobre_las_fronteras_de_tramo():
    rec = rec_pasada([0, 1, 2], [100.0, 200.0, 100.0])      # fronteras 0, 500, 1000, 1500 m en t0+0, 100, 300, 400
    par = pd.DataFrame({"route_id": "R", "stop_id": ["a", "b", "c"], "orden": [0, 1, 2], "s": [250.0, 750.0, 2000.0]})
    tp = confiable.en_paradas(rec, par)
    assert tp.stop_id.tolist() == ["a", "b"]                 # c (2.000 m) queda fuera de lo recorrido
    np.testing.assert_allclose(tp.t - (T0 + 7 * 3600), [50.0, 200.0])


def test_en_paradas_no_interpola_sobre_un_hueco():
    rec = pd.concat([rec_pasada([0], [100.0]), rec_pasada([2], [100.0], t0=T0 + 7 * 3600 + 500)])
    par = pd.DataFrame({"route_id": "R", "stop_id": ["a", "b", "c"], "orden": [0, 1, 2], "s": [250.0, 750.0, 1250.0]})
    tp = confiable.en_paradas(rec, par)
    assert tp.stop_id.tolist() == ["a", "c"]                 # b cae en el tramo 1, que falta


def test_pares_descarta_vueltas_que_nadie_haria():
    # Ruta en lazo: d queda a 300 m de a en línea recta pero a 9 km por la ruta. a->d no es un viaje razonable.
    tp = pd.DataFrame({"unidad": "u", "route_id": "R", "dia": "2026-11-23", "stop_id": list("abcd"), "orden": range(4),
                       "s": [0.0, 3000, 6000, 9000], "t": [0.0, 400, 800, 1200],
                       "x": [0.0, 3000, 3000, 300], "y": [0.0, 0, 3000, 0]})
    tro = confiable.pares(tp, {"R": "troncal"})
    assert ("a", "d") not in set(zip(tro.origen, tro.destino)) and ("a", "b") in set(zip(tro.origen, tro.destino))


def test_pares_troncal_todas_las_parejas_y_zonal_a_5_km():
    tp = pd.DataFrame({"unidad": "u", "route_id": "R", "dia": "2026-11-23", "stop_id": list("abcd"),
                       "orden": range(4), "s": [0.0, 2000, 5500, 9000], "t": [0.0, 300, 800, 1400],
                       "x": [0.0, 2000, 5500, 9000], "y": 0.0})
    tro = confiable.pares(tp, {"R": "troncal"})
    assert len(tro) == 6 and set(tro.dur_s) == {300, 800, 1400, 500, 1100, 600}
    zon = confiable.pares(tp, {"R": "zonal"})
    # Desde cada parada, la primera a 5 km o más: a->c (5.500), b->d (7.000), c y d sin destino.
    assert list(zip(zon.origen, zon.destino)) == [("a", "c"), ("b", "d")]


def test_confiabilidad_percentiles_bti_y_walkforward():
    rng = np.random.default_rng(0)
    dias = [f"2026-11-{d}" for d in (17, 18, 19, 20, 23, 24, 25, 26, 27, 30)]   # 10 días hábiles
    filas = [("R", "a", "b", d, T0 + 7 * 3600 + 86400 * i + k, 600 + rng.exponential(120))
             for i, d in enumerate(dias) for k in range(30)]
    v = pd.DataFrame(filas, columns=["route_id", "origen", "destino", "dia", "t_salida", "dur_s"])
    c, wf = confiable.confiabilidad(v)
    r = c.iloc[0]
    assert r.hora == 7 and r.n == 300 and r.p50 < r.p95
    assert abs(r.bti - (r.p95 - r.media) / r.media) < 1e-12
    # Mismo proceso en todos los días: el p95 de los primeros 6 debe cubrir cerca del 95 % de los últimos 4.
    assert 0.9 < wf["cobertura"] < 0.99 and wf["dias_prueba"] == dias[6:]


def test_programado_lee_horas_mayores_a_24():
    st = pd.DataFrame({"trip_id": ["x.1.R"] * 2, "stop_id": ["a", "b"], "stop_sequence": [1, 2],
                       "arrival_time": ["24:10:00", "24:30:00"]})
    par = pd.DataFrame({"route_id": "R", "stop_id": ["a", "b"], "orden": [0, 1], "s": [0.0, 6000.0]})
    tp = confiable.programado(st, par, t_ref=T0)
    # El horario cuenta desde la medianoche del día de servicio: 24:10 es la 00:10 del día siguiente.
    assert tp.t.tolist() == [T0 + 24 * 3600 + 600, T0 + 24 * 3600 + 1800]
    assert tp.unidad.tolist() == ["x.1.R"] * 2 and (tp.dia == "programado").all()
