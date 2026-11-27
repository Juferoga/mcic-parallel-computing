"""Lista las capturas de posiciones de los días de servicio pedidos, leyendo el repo de capturas carpeta por carpeta
(el árbol recursivo de la API de GitHub responde 500 con un repo de este tamaño).

Uso (desde pipeline/): uv run python ../datos/listar.py 2026-11-11 2026-11-24 > ../datos/dias.txt
Sin fechas: imprime los días UTC publicados.
"""

import json
import sys
import urllib.request
from datetime import date, timedelta

from tm.nucleo import es_del_dia

API = "https://api.github.com/repos/Fozzy3/parallel-computing-final/git/trees/"


def arbol(sha: str) -> dict:
    with urllib.request.urlopen(API + sha, timeout=60) as r:
        return {x["path"]: x["sha"] for x in json.load(r)["tree"]}


def carpetas_utc() -> dict:
    """'AAAA/MM/DD' -> sha de la carpeta, para todos los días publicados."""
    sal = {}
    anios = arbol(arbol("main")["raw"])
    for a, sa in anios.items():
        for m, sm in arbol(sa).items():
            for d, sd in arbol(sm).items():
                sal[f"{a}/{m}/{d}"] = sd
    return sal


def main():
    utc = carpetas_utc()
    if len(sys.argv) < 3:
        print("\n".join(sorted(utc)))
        return
    d0, d1 = date.fromisoformat(sys.argv[1]), date.fromisoformat(sys.argv[2])
    dias = [d0 + timedelta(i) for i in range((d1 - d0).days + 1)]
    for c in sorted({f"{x:%Y/%m/%d}" for d in dias for x in (d, d + timedelta(1))} & set(utc)):
        for nombre in sorted(arbol(utc[c])):
            ruta = f"raw/{c}/{nombre}"
            if any(es_del_dia(ruta, str(d)) for d in dias):
                print(ruta)


if __name__ == "__main__":
    main()
