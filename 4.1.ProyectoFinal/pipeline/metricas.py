"""Salidas del proyecto 1 a partir de los tramos del pipeline.

  resultados/tramos.parquet          velocidad p20/p50/p80 y retraso por ruta, tramo, tipo de día y hora, con ubicación
  resultados/ranking_mixto.csv       celdas de 250 m con más bus-horas perdidas por día hábil: zonal y alimentador
                                     (tráfico mixto: candidatos a carril preferencial o prioridad semafórica)
  resultados/ranking_exclusivo.csv   lo mismo para troncal y dual (carril exclusivo: otro tipo de intervención)
  resultados/resumen.json            velocidad comercial y retraso por sistema, velocidad mediana por hora
  resultados/validacion.json         (a) error sintético, (b) estabilidad entre semanas, (c) IC por bootstrap,
                                     (d) magnitudes frente a las cifras oficiales de 2024

Uso: python metricas.py --out /tmp/tm41 --gtfs ../datos/gtfs/GTFS.zip --resultados ../resultados
"""

import argparse
import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow.dataset as pads

from tm import nucleo, sintetico

PICO = [6, 7, 17, 18]
GRUPOS = {"mixto": {"zonal", "alimentador"}, "exclusivo": {"troncal", "dual"}}
OFICIAL_2024 = {"troncal": 25.2, "dual": 19.8, "alimentador": 17.5}  # km/h, TransMilenio (ver investigacion/)
B = 1000  # remuestreos del bootstrap


def leer(carpeta: Path) -> pd.DataFrame:
    return pd.concat([pd.read_parquet(f) for f in sorted(carpeta.glob("*.parquet"))], ignore_index=True)


def ubicar(t: pd.DataFrame, geos: dict) -> pd.DataFrame:
    """Centro (x, y) en metros y (lon, lat) de cada (ruta, tramo)."""
    xy = np.full((len(t), 2), np.nan)
    for r, idx in t.groupby("route_id").indices.items():
        xy[idx] = nucleo.punto(geos[r], (t.tramo.to_numpy()[idx] + 0.5) * nucleo.TRAMO)
    t = t.assign(x=xy[:, 0], y=xy[:, 1])
    t["lon"], t["lat"] = nucleo.a_grados(xy)
    return t.assign(cx=(t.x // nucleo.CELDA).astype(np.int64), cy=(t.y // nucleo.CELDA).astype(np.int64))


def ranking(hab: pd.DataFrame, top: int) -> pd.DataFrame:
    """Día hábil de un grupo de sistemas -> celdas ordenadas por bus-horas de retraso por día."""
    por_tramo = hab.groupby(["route_id", "ruta", "sistema", "tramo", "x", "y", "cx", "cy"], as_index=False).retraso_h.sum()
    c = nucleo.celdas(por_tramo.drop(columns=["cx", "cy"]))
    nombres = por_tramo.sort_values("retraso_h", ascending=False).groupby(["cx", "cy"]).agg(
        rutas_top=("ruta", lambda s: " ".join(list(dict.fromkeys(s))[:5])),  # zonales en pareja repiten código
        sistemas=("sistema", lambda s: "/".join(sorted(set(s)))))
    v_pico = hab[hab.hora.isin(PICO)].groupby(["cx", "cy"]).v_p50.median().rename("v_p50_pico")
    c = c.join(nombres, on=["cx", "cy"]).join(v_pico, on=["cx", "cy"])
    c["lon"], c["lat"] = nucleo.a_grados(c[["x", "y"]].to_numpy())
    return c.head(top)


def por_celda_y_dia(td: pd.DataFrame) -> pd.DataFrame:
    """Retraso por (celda, día hábil): matriz celdas × días."""
    return td.groupby(["cx", "cy", "dia"]).retraso_h.sum().unstack("dia", fill_value=0.0)


def estabilidad(m: pd.DataFrame) -> dict:
    """(b) Spearman del retraso por celda entre la primera y la segunda mitad de los días hábiles."""
    dias = sorted(m.columns)
    a, b = m[dias[: len(dias) // 2]].mean(axis=1), m[dias[len(dias) // 2:]].mean(axis=1)
    top = a.nlargest(200).index.union(b.nlargest(200).index)
    return {"dias_a": dias[: len(dias) // 2], "dias_b": dias[len(dias) // 2:],
            "spearman_top200": round(float(a[top].rank().corr(b[top].rank())), 3),  # Spearman sin scipy
            "solape_top20": int(len(a.nlargest(20).index.intersection(b.nlargest(20).index)))}


def bootstrap(m: pd.DataFrame, celdas: pd.DataFrame, semilla=0) -> pd.DataFrame:
    """(c) IC 95 % del retraso medio por día de las celdas del ranking, remuestreando días hábiles completos.
    ponytail: matriz chica (celdas × días), numpy vectorizado; Ray no aporta aquí."""
    x = m.reindex(pd.MultiIndex.from_frame(celdas[["cx", "cy"]])).fillna(0.0).to_numpy()
    idx = np.random.default_rng(semilla).integers(0, x.shape[1], size=(B, x.shape[1]))
    medias = x[:, idx].mean(2)  # (celdas, B)
    return celdas.assign(ic_bajo=np.quantile(medias, 0.025, axis=1), ic_alto=np.quantile(medias, 0.975, axis=1))


def carriles(hab: pd.DataFrame, archivo: Path) -> dict:
    """Séptima (calle 28 a 100) y Carrera 13 (calle 19 a 67), vías tomadas de OpenStreetMap (datos/carriles.csv).
    Para las rutas que recorren el carril (3 tramos o más dentro), velocidad dentro frente a fuera del carril en la
    misma ruta, en bruto y relativa a su flujo libre. Es una comparación transversal y descriptiva: no hay datos de
    antes del carril, así que no mide su efecto."""
    if not archivo.exists():
        return {}
    c = pd.read_csv(archivo).sort_values(["carril", "way", "orden"])
    sal = {}
    for nombre, g in c.groupby("carril"):
        vias = [nucleo.a_metros(w.lon, w.lat) for _, w in g.groupby("way") if len(w) >= 2]
        dentro = nucleo.cerca(hab[["x", "y"]].to_numpy(), vias, 30.0)
        h = hab.assign(dentro=dentro, v_rel=hab.v_p50 / (nucleo.TRAMO / hab.t_ff * 3.6))
        usa = h[h.dentro].groupby("route_id").tramo.nunique()
        h = h[h.route_id.isin(usa[usa >= 3].index)]
        franjas = {"pico": h.hora.isin(PICO), "valle": h.hora.between(9, 15)}
        sal[nombre] = {"rutas": int(h.route_id.nunique()), **{
            f: {lado: {"v_p50": round(float(x.v_p50.median()), 1), "v_rel": round(float(x.v_rel.median()), 3),
                       "tramos": int(len(x))}
                for lado, x in (("dentro", h[m & h.dentro]), ("fuera", h[m & ~h.dentro]))}
            for f, m in franjas.items()}}
    return sal


def confiabilidad(out: Path, res: Path, gtfs: str, sis: dict, rutas: pd.DataFrame) -> dict:
    """Proyecto 2: cuánto reservar entre paradas y dónde el horario se queda corto o le sobra tiempo.
      confiabilidad.parquet         p50/p80/p95, BTI, PTI y horario por par de paradas, tipo de día y hora
      menos_confiables_<grupo>.csv  pares de día hábil en pico con más minutos de colchón (p95 − p50)
      walkforward.json              cobertura del colchón p95 en días apartados"""
    d = out / "confiabilidad"
    if not d.exists():
        return {}
    nombres = pd.read_csv(io.BytesIO(zipfile.ZipFile(gtfs).read("stops.txt")), dtype={"stop_id": str}).set_index("stop_id").stop_name
    c = leer(d)
    c = c.assign(sistema=c.route_id.map(sis), ruta=c.route_id.map(rutas.route_short_name),
                 desde=c.origen.map(nombres), hasta=c.destino.map(nombres))
    c["holgura"] = np.select([c.p50 > c.programado_p50, c.programado_p50 > c.p80], ["corto", "sobra"], "ok")
    c.loc[c.programado_p50.isna(), "holgura"] = "sin_horario"
    c.to_parquet(res / "confiabilidad.parquet", index=False)
    pico = c[(c.tipo_dia == "laboral") & c.hora.isin(PICO) & (c.p50 >= 600) & (c.n >= 20)]
    pico = pico.assign(colchon_min=(pico.p95 - pico.p50) / 60, p50_min=pico.p50 / 60, p95_min=pico.p95 / 60)
    cols = ["ruta", "sistema", "desde", "hasta", "hora", "n", "p50_min", "p95_min", "colchon_min", "bti", "pti", "holgura"]
    for g, s in GRUPOS.items():
        pico[pico.sistema.isin(s)].nlargest(100, "colchon_min")[cols].round(2).to_csv(
            res / f"menos_confiables_{g}.csv", index=False)
    wf = json.loads((out / "walkforward.json").read_text()) if (out / "walkforward.json").exists() else {}
    json.dump(wf, open(res / "walkforward.json", "w"), ensure_ascii=False, indent=1)
    hab = c[c.tipo_dia == "laboral"]
    return {"pares_hora": int(len(c)), "walkforward_cobertura": wf.get("cobertura"),
            "bti_mediana_pico": {s: round(float(g.bti.median()), 3) for s, g in hab[hab.hora.isin(PICO)].groupby("sistema")},
            "holgura_dia_habil": {s: g.holgura.value_counts(normalize=True).round(3).to_dict() for s, g in hab.groupby("sistema")}}


def velocidad_comercial(out: Path, sis: dict) -> dict:
    """Σ distancia / Σ tiempo por sistema, sobre todos los recorridos de tramo."""
    t = pads.dataset(str(out / "recorridos"), format="parquet").to_table(columns=["route_id", "dur_s"]).to_pandas()
    g = t.assign(sistema=t.route_id.map(sis)).groupby("sistema").dur_s.agg(["size", "sum"])
    return (g["size"] * nucleo.TRAMO / g["sum"] * 3.6).round(1).to_dict()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--gtfs", required=True)
    ap.add_argument("--resultados", required=True)
    ap.add_argument("--top", type=int, default=100)
    a = ap.parse_args()
    out, res = Path(a.out), Path(a.resultados)
    res.mkdir(parents=True, exist_ok=True)

    geos, sis = nucleo.cargar_geometrias(a.gtfs), nucleo.sistemas(a.gtfs)
    rutas = pd.read_csv(io.BytesIO(zipfile.ZipFile(a.gtfs).read("routes.txt")), dtype=str).set_index("route_id")
    t = ubicar(leer(out / "tramos"), geos)
    t["sistema"], t["ruta"] = t.route_id.map(sis), t.route_id.map(rutas.route_short_name)
    t.drop(columns=["cx", "cy"]).to_parquet(res / "tramos.parquet", index=False)
    td = ubicar(leer(out / "tramos_dia"), geos)
    td = td[td.dia.map(nucleo.tipo_dia) == "laboral"].assign(sistema=lambda d: d.route_id.map(sis))

    hab = t[t.tipo_dia == "laboral"]
    val = {}
    for g, s in GRUPOS.items():
        c = ranking(hab[hab.sistema.isin(s)], a.top)
        m = por_celda_y_dia(td[td.sistema.isin(s)])
        c = bootstrap(m, c)
        c.drop(columns=["cx", "cy", "x", "y"]).round(4).to_csv(res / f"ranking_{g}.csv", index_label="puesto")
        val[f"estabilidad_{g}"] = estabilidad(m) if m.shape[1] >= 4 else "menos de 4 días hábiles"
        print(f"\n== {g} ==\n", c.head(10).drop(columns=["cx", "cy", "x", "y"]).round(2).to_string())

    e = sintetico.errores(range(200))
    vc = velocidad_comercial(out, sis)
    val["sintetico_52s"] = {"tramos": e.n, "sesgo_rel": round(float(e.sesgo_rel), 4),
                            "mediana_abs_rel": round(e.mediana_abs_rel, 4), "p90_abs_rel": round(e.p90_abs_rel, 4)}
    val["magnitudes_vs_2024"] = {s: {"medida": vc.get(s), "oficial": o, "dif_rel": round(vc[s] / o - 1, 3)}
                                 for s, o in OFICIAL_2024.items() if s in vc}
    json.dump(val, open(res / "validacion.json", "w"), ensure_ascii=False, indent=1)
    car = carriles(hab, Path(__file__).parent.parent / "datos" / "carriles.csv")
    json.dump(car, open(res / "carriles.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(car, ensure_ascii=False))

    resumen = {"velocidad_comercial": vc,
               "bus_horas_retraso_dia_habil": {s: round(float(g.retraso_h.sum()), 1) for s, g in hab.groupby("sistema")},
               "v_p50_por_hora": {s: g.groupby("hora").v_p50.median().round(1).to_dict() for s, g in hab.groupby("sistema")},
               "dias": sorted(td.dia.unique().tolist()), "tramos": len(t),
               "confiabilidad": confiabilidad(out, res, a.gtfs, sis, rutas)}
    json.dump(resumen, open(res / "resumen.json", "w"), ensure_ascii=False, indent=1)
    print(json.dumps(val, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
