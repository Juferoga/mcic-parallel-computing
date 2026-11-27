import numpy as np
import pandas as pd

from tm import nucleo


def ida_y_vuelta():
    """Ruta de 5 km al oriente y de vuelta por la misma calle (10 m al norte): un solo shape, como muchas zonales."""
    x = np.linspace(0, 5000, 51)
    p = np.vstack([np.column_stack([x, np.zeros_like(x)]), np.column_stack([x[::-1], np.full_like(x, 10.0)])])
    return nucleo.geometria(p)


def test_emparejar_usa_el_sentido_de_marcha_en_ida_y_vuelta():
    # Bus a mitad de calle (y=5, empate de distancia) que va al occidente: está en la vuelta, que empieza en
    # s = 5010 (5 km de ida + 10 m de unión), así que s va de 6010 a 9010.
    x = np.arange(4000, 999, -250.0)
    s, desvio = nucleo.emparejar(np.column_stack([x, np.full_like(x, 5.0)]), ida_y_vuelta())
    np.testing.assert_allclose(s, 5010 + (5000 - x), atol=1)
    assert (desvio <= 6).all()


def test_emparejar_bus_detenido_hereda_el_sentido():
    # Va al oriente, se detiene 3 reportes y sigue: los detenidos no saltan a la vuelta.
    x = np.array([1000, 1250, 1500, 1500, 1500, 1500, 1750, 2000.0])
    s, _ = nucleo.emparejar(np.column_stack([x, np.full_like(x, 5.0)]), ida_y_vuelta())
    np.testing.assert_allclose(s, x, atol=1)


def test_emparejar_lejos_de_la_ruta_es_nan():
    s, desvio = nucleo.emparejar(np.array([[2000.0, 500.0], [2100.0, 500.0]]), ida_y_vuelta())
    assert np.isnan(s).all() and (desvio > nucleo.MAX_DESVIO).all()


def test_pasadas_corta_por_retroceso_hueco_y_cambio_de_ruta():
    ts = np.array([0, 50, 100, 150, 200, 900, 950, 1000])
    s = np.array([0, 400, 900, 100, 600, 1200, 1500, 1800.0])
    ruta = np.array(["A"] * 7 + ["B"])
    assert nucleo.pasadas(ts, s, ruta).tolist() == [0, 0, 0, 1, 1, 2, 2, 3]


def test_pasadas_corta_por_salto_imposible():
    # De 400 a 3000 m en 50 s = 187 km/h: el emparejamiento saltó a otra parte del shape.
    ts = np.array([0, 50, 100, 150])
    s = np.array([0, 400, 3000, 3300.0])
    assert nucleo.pasadas(ts, s, np.array(["A"] * 4)).tolist() == [0, 0, 1, 1]


def test_pasadas_corta_tras_una_espera_larga():
    # Avanza, se queda 11 min quieto (terminal a mitad del shape, con ±5 m de ruido) y sigue: otra pasada.
    quieto = 600 + np.array([0, 5, -4, 3, 0, -5, 2, 4, -3, 1, 0, 2.0])
    s = np.concatenate([[0, 300], quieto, [900, 1200]])
    ts = np.arange(len(s)) * 60
    p = nucleo.pasadas(ts, s, np.array(["A"] * len(s)))
    assert p[0] == p[2] and p[-1] == p[-2] and p[-1] != p[0]
    # Una parada corta (3 min) no corta.
    s2 = np.array([0, 300, 600, 602, 599, 601, 900, 1200.0])
    assert len(set(nucleo.pasadas(np.arange(8) * 60, s2, np.array(["A"] * 8)))) == 1


def test_recorridos_sin_velocidades_imposibles():
    df = pd.DataFrame({"dia": "2026-11-23", "vehicle_id": "V1", "route_id": "R",
                       "ts": 1795410000 + np.arange(6) * 52.0, "s": [0, 260, 520, 9000, 9260, 9520.0]})
    r = nucleo.recorridos(df)
    assert (500 / r.dur_s * 3.6 <= nucleo.V_MAX * 3.6).all()


def bus(v_ms, largo, cada=52.0, dia="2026-11-23", t0=1795410000):
    """Reportes sintéticos de un bus a velocidad v(s) por tramos, muestreados cada `cada` segundos."""
    t, s, out = 0.0, 0.0, []
    while s <= largo:
        out.append((t0 + t, s))
        s += v_ms(s) * cada
        t += cada
    ts, ss = map(np.array, zip(*out))
    return pd.DataFrame({"dia": dia, "vehicle_id": "V1", "route_id": "R", "ts": ts, "s": ss})


def test_recorridos_a_velocidad_constante_dan_el_tiempo_exacto():
    r = nucleo.recorridos(bus(lambda s: 5.0, 3000))
    # Tramos completos 0..5 (el último puede quedar sin cerrar); cada uno tarda 500/5 = 100 s.
    assert r.tramo.tolist() == list(range(len(r)))
    assert len(r) >= 5
    np.testing.assert_allclose(r.dur_s, 100.0, atol=1e-6)


def test_recorridos_no_cruzan_pasadas():
    a = bus(lambda s: 5.0, 1200)
    b = bus(lambda s: 5.0, 1200, t0=1795410000 + 5000)  # vuelve a empezar la ruta: otra pasada
    r = nucleo.recorridos(pd.concat([a, b], ignore_index=True))
    assert r.tramo.tolist() == [0, 1, 0, 1]


def test_agregar_percentiles_y_retraso_contra_flujo_libre():
    # Un tramo de una ruta: 20 recorridos en la hora 3 (100 s) y 20 en la hora 7 (200 s, el doble de lento).
    t0 = 1795410000  # 2026-11-23 00:00 Bogotá
    filas = [("R", 0, t0 + 3 * 3600 + i, 100.0) for i in range(20)] + [("R", 0, t0 + 7 * 3600 + i, 200.0) for i in range(20)]
    rec = pd.DataFrame(filas, columns=["route_id", "tramo", "t_ini", "dur_s"])
    rec["dia"] = "2026-11-23"
    a = nucleo.agregar(rec).set_index("hora")
    assert a.loc[3, "v_p50"] == 18.0 and a.loc[7, "v_p50"] == 9.0
    assert a.loc[3, "n"] == 20 and a.loc[3, "tipo_dia"] == "laboral"
    # Flujo libre = p5 de la duración del tramo en todo el periodo = 100 s: la hora 7 pierde 100 s por recorrido.
    assert a.loc[3, "retraso_h"] == 0.0 and a.loc[7, "t_ff"] == 100.0
    assert abs(a.loc[7, "retraso_h"] - 20 * 100 / 3600) < 1e-9


def test_retraso_por_dia():
    t0 = 1795410000  # 2026-11-23 00:00 Bogotá
    filas = [("R", 0, t0 + 100 * i, 100.0, "2026-11-23") for i in range(19)] + [("R", 0, t0 + 86400, 300.0, "2026-11-24")]
    rec = pd.DataFrame(filas, columns=["route_id", "tramo", "t_ini", "dur_s", "dia"])
    d = nucleo.retraso_por_dia(rec).set_index("dia")
    assert d.loc["2026-11-23", "retraso_h"] == 0.0
    assert abs(d.loc["2026-11-24", "retraso_h"] - 200 / 3600) < 1e-9  # flujo libre 100 s, tardó 300


def test_punto_sobre_la_ruta():
    # A 5.250 m de la ida y vuelta: 240 m después del giro (5.010), sobre la vuelta.
    np.testing.assert_allclose(nucleo.punto(ida_y_vuelta(), np.array([2500.0, 5250.0])), [[2500, 0], [4760, 10]])


def test_celdas_suman_rutas_que_comparten_calle():
    t = pd.DataFrame({"route_id": ["A", "B", "C"], "x": [1010.0, 1100.0, 3000.0], "y": [20.0, 30.0, 0.0],
                      "retraso_h": [1.0, 2.0, 5.0]})
    c = nucleo.celdas(t)
    assert c.retraso_h.tolist() == [5.0, 3.0] and c.rutas.tolist() == [1, 2]


def test_captura_del_dia_de_servicio_en_hora_de_bogota():
    # El día de Bogotá D va de D 05:00 UTC a D+1 05:00 UTC.
    assert nucleo.es_del_dia("raw/2026/11/23/positions_20261123T050010Z.pb.gz", "2026-11-23")
    assert nucleo.es_del_dia("raw/2026/11/24/positions_20261124T045950Z.pb.gz", "2026-11-23")
    assert not nucleo.es_del_dia("raw/2026/11/23/positions_20261123T045950Z.pb.gz", "2026-11-23")
    assert not nucleo.es_del_dia("raw/2026/11/24/positions_20261124T050000Z.pb.gz", "2026-11-23")
    assert not nucleo.es_del_dia("raw/2026/11/23/alerts_20261123T120000Z.pb.gz", "2026-11-23")


def test_cerca_de_una_polilinea():
    via = [np.array([[0.0, 0.0], [0.0, 1000.0]])]               # calle norte-sur de 1 km
    xy = np.array([[20.0, 500.0], [45.0, 500.0], [0.0, 1025.0], [0.0, 1100.0]])
    assert nucleo.cerca(xy, via, 30).tolist() == [True, False, True, False]


def test_tipo_dia():
    assert nucleo.tipo_dia("2026-11-23") == "laboral"
    assert nucleo.tipo_dia("2026-11-16") == "domingo_festivo"   # festivo (Independencia de Cartagena, trasladado)
    assert nucleo.tipo_dia("2026-11-21") == "sabado"
    assert nucleo.tipo_dia("2026-11-22") == "domingo_festivo"
