"""Auditoría del feed por hora, sobre las posiciones ya filtradas del ETL (sin zombis de más de 5 min).

  resultados/calidad.csv   por día y hora de Bogotá: capturas, reportes, buses, % duplicados y edad mediana del reporte
  Una hora de servicio (5 a 23 h) con menos de la mitad de los buses de la mediana de esa hora, en su mismo tipo de
  día, se marca como hueco.

Uso: python calidad.py --out ../datos/salida/completo --resultados ../resultados
"""

import argparse
from pathlib import Path

import pandas as pd

from tm import nucleo


def por_hora(df: pd.DataFrame) -> pd.DataFrame:
    df = df.assign(hora=((df.captura + nucleo.BOG) // 3600) % 24)
    g = df.groupby("hora")
    out = g.agg(capturas=("captura", "nunique"), reportes=("ts", "size"), buses=("vehicle_id", "nunique"),
                edad_mediana_s=("edad", "median"))
    unicos = df.drop_duplicates(["vehicle_id", "ts"]).groupby("hora").size()
    out["duplicados_pct"] = (1 - unicos / out.reportes).mul(100).round(1)
    return out.reset_index()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--resultados", required=True)
    a = ap.parse_args()
    filas = []
    for d in sorted(Path(a.out, "posiciones").glob("dia=*")):
        df = pd.read_parquet(d, columns=["captura", "ts", "vehicle_id"])
        df["edad"] = df.captura - df.ts
        filas.append(por_hora(df).assign(dia=d.name.split("=", 1)[1]))
    c = pd.concat(filas, ignore_index=True)
    servicio = c.hora.between(5, 23)
    c["tipo_dia"] = c.dia.map(nucleo.tipo_dia)  # un domingo tiene menos buses que un lunes: comparar con su tipo de día
    c["hueco"] = servicio & (c.buses < 0.5 * c.groupby(["tipo_dia", "hora"]).buses.transform("median"))
    Path(a.resultados).mkdir(parents=True, exist_ok=True)
    c.to_csv(Path(a.resultados) / "calidad.csv", index=False)
    print(c.groupby("dia").agg(reportes=("reportes", "sum"), buses_max=("buses", "max"), horas_hueco=("hueco", "sum"),
                               duplicados_pct=("duplicados_pct", "median")).to_string())


if __name__ == "__main__":
    main()
