import numpy as np
import pandas as pd

from tm import acceso


def test_numero_con_coma_decimal():
    assert acceso.numero(pd.Series([" 46,63 ", "1.234,5", " - ", "7"])).tolist()[:2] == [46.63, 1234.5]
    assert np.isnan(acceso.numero(pd.Series([" - "]))[0])


def test_zonas_empleo_por_viajes_a_trabajar_y_estrato_mediano():
    viajes = pd.DataFrame({"zat_des": [1, 1, 2, 2], "motivo_viaje": [" A trabajar", " A trabajar", " A Estudiar", " A trabajar"],
                           "nom_mun_des": ["Bogotá"] * 3 + ["Soacha"], "fexp_vj": [" 10,0 ", " 5,0 ", " 99 ", " 7 "]})
    hogares = pd.DataFrame({"zat_hg": [1, 1, 1, 2], "estrato_hg": ["2", "2", "4", "No aplica"],
                            "nom_mpio_hg": ["Bogotá D.C."] * 4, "fexp_hg": [" 1 ", " 1 ", " 1 ", " 1 "]})
    z = acceso.zonas(viajes, hogares).set_index("zat")
    assert z.loc[1, "empleo"] == 15.0          # solo viajes a trabajar con destino en Bogotá
    assert z.loc[1, "estrato"] == 2.0          # mediana ponderada de los hogares
    assert np.isnan(z.loc[2, "estrato"]) and z.loc[2, "empleo"] == 0.0


def test_reprogramar_cambia_los_tiempos_por_los_observados():
    # Viaje de 3 paradas a 0, 500 y 1.500 m; sale 07:00. Horario: 100 s entre cada parada.
    st = pd.DataFrame({"trip_id": "x.1.R", "route_id": "R", "stop_id": ["a", "b", "c"], "stop_sequence": [1, 2, 3],
                       "t": [25200, 25300, 25400]})
    s = {("R", "a"): 0.0, ("R", "b"): 500.0, ("R", "c"): 1500.0}
    # Observado a las 7: tramo 0 tarda 60 s, tramo 1 tarda 120 s, tramo 2 no se midió.
    obs = {("R", 0, 7): 60.0, ("R", 1, 7): 120.0}
    t = acceso.reprogramar(st, s, obs)
    # a->b: tramo 0 completo = 60 s. b->c: tramo 1 (120 s) + tramo 2 sin dato -> mitad del horario de ese salto (50 s).
    assert t.tolist() == [25200, 25260, 25260 + 120 + 50]


def test_accesibilidad_acumulada():
    tt = pd.DataFrame({"from_id": [1, 1, 1, 2], "to_id": [1, 2, 3, 3], "travel_time": [5, 50, 70, np.nan]})
    empleo = pd.Series({1: 100.0, 2: 10.0, 3: 1.0})
    a = acceso.acumulada(tt, empleo, 60)
    assert a.to_dict() == {1: 110.0, 2: 0.0}
