"""Cuánto cuesta el retraso y cuánto devuelve cada km de carril tratado en orden de ahorro.

  resultados/economia.json   supuestos con fuente, costo del retraso, curva km → bus-horas y escenarios de presupuesto

Uso: python valorar.py --resultados ../resultados
"""

import argparse
import json
from pathlib import Path

import pandas as pd

from tm import economia

DIAS_HABILES = 7  # días hábiles del 12 al 23 de noviembre (sin el festivo del 16)
MIXTO = ["zonal", "alimentador"]
EFECTOS = (0.10, 0.20)  # subida de velocidad en la celda tratada: rango de otras ciudades (ver presentación)
KM = (10, 25, 50)  # presupuestos que se muestran
# ponytail: supuestos fijos con fuente; cambian la cifra en pesos, no el orden de las celdas.
SUP = {
    "costo_sitp": 6.9e12,  # COP/año, todo el SITP (gerente de TransMilenio, La República, 2026)
    "km_mes": {"troncal": 11.3e6, "zonal": 29.3e6, "alimentador": 4.2e6},  # TransMilenio, informe #97, dic-2025
    "ipk": {"mixto": 1.4, "exclusivo": 4.5},  # validaciones por bus-km, zonal y troncal (informe #97)
    "viaje_km": 10,  # supuesto: km medios de un viaje en bus; carga a bordo = IPK × viaje
    "salario_h": 1_750_905 / 210,  # mínimo 2026 (Decreto 1469/2025) / 210 h al mes desde jul-2026
    "fraccion_tiempo": 0.5,  # valor del tiempo = 50 % del salario (Whittington y Cook, 2019)
    "dias_habiles": 250,  # por año
    "costo_km": 1e9,  # supuesto: COP por km de carril segregado con cámaras, 4× la Séptima de 2014 (IDU: 250 M/km)
    "fuentes": ["costo del SITP: TransMilenio en La República (2026)", "km e IPK: TransMilenio, informe 97 (dic-2025)",
                "salario mínimo 2026: Decreto 1469 de 2025", "valor del tiempo = 50 % del salario: Whittington y Cook (2019)",
                "km por viaje (10) y costo por km de carril: supuestos nuestros"],
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--resultados", required=True)
    res = Path(ap.parse_args().resultados)
    t = pd.read_parquet(res / "tramos.parquet", columns=["tipo_dia", "sistema", "n", "t_ff", "retraso_h", "x", "y"])
    hab = t[t.tipo_dia == "laboral"]
    libre = (hab.n / DIAS_HABILES * hab.t_ff / 3600).groupby(hab.sistema).sum()
    retraso = hab.groupby("sistema").retraso_h.sum()
    pct = (100 * retraso / (libre + retraso)).round(1)

    vc = json.loads((res / "resumen.json").read_text())["velocidad_comercial"]
    bus_h_anio = sum(12 * km / vc[k] for k, km in SUP["km_mes"].items())
    costo_bus_h = SUP["costo_sitp"] / bus_h_anio  # costo medio: incluye gestor y recaudo
    vot = SUP["fraccion_tiempo"] * SUP["salario_h"]
    pas = {g: SUP["ipk"][g] * SUP["viaje_km"] for g in SUP["ipk"]}
    grupo = {s: g for g, ss in (("mixto", MIXTO), ("exclusivo", ["troncal", "dual"])) for s in ss}
    pas_h = sum(retraso[s] * pas[grupo[s]] for s in retraso.index if s in grupo)
    v = costo_bus_h + pas["mixto"] * vot  # COP por bus-hora recuperada en tráfico mixto
    anio = v * SUP["dias_habiles"] / 1e9  # mil millones de COP al año por bus-hora diaria recuperada
    c = economia.celdas(hab[hab.sistema.isin(MIXTO)], DIAS_HABILES)
    bajo, alto = (economia.curva(c, e) for e in EFECTOS)
    curva = [{"km": float(km), "bajo": round(float(bajo.ahorro_acum_h[bajo.km <= km].max())),
              "alto": round(float(alto.ahorro_acum_h[alto.km <= km].max()))} for km in range(1, 201)]
    esc = []
    for km in KM:
        hb, ha = (float(k.ahorro_acum_h[k.km <= km].max()) for k in (bajo, alto))
        inv = km * SUP["costo_km"] / 1e9
        esc.append({"km": km, "bus_h_bajo": round(hb), "bus_h_alto": round(ha),
                    "valor_anio_bajo": round(hb * anio, 1), "valor_anio_alto": round(ha * anio, 1),
                    "costo_milmill": round(inv, 1),
                    "meses_bajo": round(12 * inv / (hb * anio), 1), "meses_alto": round(12 * inv / (ha * anio), 1)})

    total = float(retraso.sum())
    op, gente = total * costo_bus_h / 1e9, pas_h * vot / 1e9  # mil millones de COP por día hábil
    sal = {"supuestos": {**SUP, "costo_bus_h_miles": round(costo_bus_h / 1000), "valor_tiempo_miles": round(vot / 1000, 1),
                         "pasajeros": pas, "efectos": EFECTOS},
           "valor_bus_h_mixto": round(v), "retraso_bus_h": round(total), "pasajero_h_miles": round(pas_h / 1000),
           "pct_retraso": pct.to_dict(), "min_por_hora": (pct * 0.6).round().astype(int).to_dict(),
           "operacion_dia_milmill": round(op, 1), "gente_dia_milmill": round(gente, 1),
           "costo_dia_milmill": round(op + gente, 1),
           "costo_anio_bill": round((op + gente) * SUP["dias_habiles"] / 1000, 1),
           "pct_costo_sitp": round(100 * op * SUP["dias_habiles"] * 1e9 / SUP["costo_sitp"]),
           "celdas_mixto": len(c), "curva": curva, "escenarios": esc}
    json.dump(sal, open(res / "economia.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps({k: x for k, x in sal.items() if k != "curva"}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
