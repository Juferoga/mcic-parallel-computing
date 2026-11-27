"""Validación (a) del proyecto 1: ¿cuánto se equivoca el tiempo por tramo cuando el bus reporta cada ~52 s?"""

import numpy as np

from tm import sintetico


def test_tiempo_real_por_tramo_del_perfil():
    # Perfil sin paradas a 5 m/s: cada tramo de 500 m tarda 100 s.
    p = sintetico.Perfil(largo=3000, crucero=5.0, cada_parada=10_000, parada_s=0, lento=())
    np.testing.assert_allclose(sintetico.tramos_reales(p), 100.0)


def test_error_por_tramo_con_reportes_cada_52_s():
    # Perfil urbano: 8 m/s, parada de 30-60 s cada ~400 m, dos zonas de trancón a 2 m/s, GPS con ±10 m de ruido.
    e = sintetico.errores(semillas=range(40))
    # Lo que importa para el atlas: el sesgo agregado es chico y el error típico por tramo es acotado.
    assert abs(e.sesgo_rel) < 0.03
    assert e.mediana_abs_rel < 0.15
    assert e.n > 500
