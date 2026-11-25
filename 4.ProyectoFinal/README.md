# Proyecto final · Bogotá en movimiento (TransMilenio + Ray)

Analítica distribuida con **Ray** sobre el archivo del feed GTFS-Realtime abierto de TransMilenio
(posiciones de los buses desde el 11 de noviembre de 2026), en el marco del Módulo 9 del curso.

Las capturas las archiva Carlos Stiven Mora Hoyos (compañero de equipo) en
[`Fozzy3/parallel-computing-final`](https://github.com/Fozzy3/parallel-computing-final). **No se incluye como
submódulo**: pesa más de 4 GB, crece unos 300 MB por día y recibe un commit diario. Aquí se bajan solo los
archivos que hacen falta.

## Estructura

```text
proyecto_final.ipynb   cuaderno con todo el trabajo: datos, calidad, pipeline, prueba local, benchmark y métricas
datos/
  bajar.sh             baja en paralelo los archivos listados (rutas del repo de capturas)
  muestra.txt          muestra usada por la presentación (739 capturas)
  raw/ gtfs/           descargas locales (no se versionan)
docs/
  evaluacion-archivador.md   revisión crítica del archivador y de la calidad de los datos
presentacion/          presentación interactiva (Vite + three.js + GSAP), mismo motor que la de BI
  scripts/exportar_datos.py  genera src/datos.json a partir de datos/
  scripts/exportar_mapa.py   genera src/mapa.json (calles con buses, troncales y estaciones del GTFS) para el fondo
  scripts/guion_datos.js     guion del presentador (se inserta en guion.html)
pipeline/              pipeline en Ray (y su versión secuencial), métricas y scripts de Colab (ver pipeline/README.md)
resultados/            tiempos.jsonl, benchmark.json y metricas.json de la corrida en Colab (24 nov 2026)
```

## Resultados (Colab, CPU High-RAM, 8 vCPU)

| | Secuencial | Ray · 8 workers | Speedup |
|---|---|---|---|
| ETL (protobuf → Parquet) | 32,7 s | 17,4 s | 1,9× |
| Trayectorias + map-matching | 540,1 s | 104,3 s | 5,2× |
| Headways (puntos de control) | 6,3 s | 2,9 s | 2,2× |
| **Total, martes 17 (2.268 capturas, 324 MB)** | **579 s** | **124,5 s** | **4,7×** (4,65) |

Fracción paralela estimada (Amdahl): p ≈ 0,90. Los 14 días (28.958 capturas, 3,7 GB, 85,2 M reportes)
tardan 21 min con 8 workers. Métricas de los días hábiles completos: velocidad comercial en el pico 15,2 km/h,
headway mediano 10,7 min y bunching en el 12,5 % de los intervalos.

## Cuaderno

`proyecto_final.ipynb` ya viene ejecutado. Las celdas de Colab (☁) muestran el registro real de la corrida del 24 de
noviembre y no hace falta volver a correrlas; el resto corre en local:

```bash
cd pipeline && uv sync && uv run --with jupyter --with matplotlib jupyter lab ../proyecto_final.ipynb
```

## Presentación

En línea: **https://juferoga.github.io/mcic-parallel-computing/** (guion del presentador en `guion.html`). Se vuelve a
publicar sola con cada push que toque `presentacion/`.


```bash
cd datos && ./bajar.sh muestra.txt && curl -L -o gtfs/GTFS.zip https://gtfs.transmilenio.gov.co/GTFS.zip && cd ..
gh api "repos/Fozzy3/parallel-computing-final/git/trees/main?recursive=1" > datos/arbol.json
uv run --with gtfs-realtime-bindings --with pandas python presentacion/scripts/exportar_datos.py
cd presentacion && npm install && npm run dev      # http://localhost:5173
```

Teclas: `→`/`espacio` avanza, `←` retrocede, `O` vista de la ruta, `N` notas, `T` tema, `G` abre el guion
(`guion.html`, se sincroniza con la presentación en el mismo navegador).

`src/datos.json` ya viene generado, así que para solo presentar basta con `npm install && npm run dev`.

### Actualizar con nuevos resultados

Copiar `tiempos.jsonl` y `metricas.json` de una corrida nueva a `resultados/` y volver a correr
`exportar_datos.py`: arma `benchmark.json` y los lleva a los marcos de speedup, métricas, velocidad y tramos.
