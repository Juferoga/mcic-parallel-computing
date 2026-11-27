# Proyecto final 4.1 · Dónde pierden tiempo los buses de Bogotá (TransMilenio + Ray)

Juan Felipe Rodríguez Galindo y Carlos Stiven Mora Hoyos · Computación Paralela, MCIC, 2026-3.

## Problema

Los buses de Bogotá son cada año más lentos. La velocidad zonal en el pico de la mañana bajó de 26,8 a 24,9 km/h
entre 2023 y 2024, según un análisis de la Subgerencia Económica de TransMilenio de diciembre de 2024
([El Carro Colombiano](https://www.elcarrocolombiano.com/movilidad/transmilenio-ampliacion-tiempo-transbordo-150-minutos-bogota/)),
y la demanda zonal cayó 7,7 % en un semestre según la Supertransporte
([Portafolio](https://www.portafolio.co/economia/cae-demanda-de-pasajeros-en-el-transporte-masivo-del-pais-521267)).
La ciudad decide carriles exclusivos y prioridad semafórica sin un mapa público de dónde y cuándo se frenan los buses.
Nueva York (MTA, Contraloría) y California (Cal-ITP) publican ese mapa a partir de las posiciones de los buses; Bogotá
abrió su feed GTFS-Realtime en noviembre de 2026 y nadie lo analiza en histórico. Detalle y fuentes:
[`investigacion/reports/`](investigacion/reports/).

## Qué se hace

Tres soluciones sobre un mismo pipeline en Ray:

1. **Atlas de velocidad y retraso por tramo.** Velocidad p20/p50/p80 por ruta, tramo de 500 m y hora, y un ranking de
   las calles (celdas de 250 m) donde los buses pierden más bus-horas frente a su flujo libre: dónde un carril o un
   semáforo prioritario recuperaría más tiempo. Un ranking para tráfico mixto (zonal y alimentador) y otro para
   carril exclusivo (troncal y dual).
2. **Tiempo de viaje confiable entre paradas.** Cuánto reservar para llegar a tiempo 19 de cada 20 veces (p95,
   Buffer Time Index, Planning Time Index), validado con días apartados, y dónde el horario oficial se queda corto.
3. **Brecha de accesibilidad al empleo** entre el horario y la operación observada, por estrato (r5py + Encuesta de
   Movilidad 2023).

No se usan intervalos entre buses (headways): ese es el tema de la tesis.

## Resultados (12 al 23 de noviembre de 2026)

27.599 capturas (3,5 GB), 80,9 M posiciones y 23 M recorridos de tramo. El 11 de noviembre queda fuera: el archivo
empezó ese día.

| | Troncal | Dual | Alimentador | Zonal |
|---|---|---|---|---|
| Velocidad comercial (km/h) | 21,8 | 17,9 | 14,3 | 14,3 |
| Oficial 2024 (km/h) | 25,2 | 19,8 | 17,5 | — |
| Retraso frente al flujo libre (bus-horas por día hábil) | 3.865 | 928 | 1.597 | 29.478 |
| Colchón típico en el pico (BTI mediano) | 0,18 | 0,22 | 0,25 | 0,21 |

- **Dónde se frenan:** la celda de tráfico mixto con más retraso está en el sur (Usme, lat 4,51), con 96 bus-horas por
  día hábil (IC 95 % de 85 a 106) y 56 rutas. En carril exclusivo, la Caracas en el centro, con medianas de 5 a 6 km/h
  en el pico. Rankings en `resultados/ranking_mixto.csv` y `ranking_exclusivo.csv`.
- **Carriles (descriptivo, no causal: no hay datos de antes):** en el pico, las rutas que usan el carril de la Séptima
  (calles 28 a 100) van a 14,0 km/h dentro y a 14,9 fuera; en la Carrera 13 (calles 19 a 67), a 12,1 dentro y 14,1
  fuera. Los carriles están en el centro denso, donde todo es más lento.
- **Cuánto reservar:** el p95 calculado con 4 días hábiles cubre el 87,5 % de los viajes de los 3 siguientes, no el
  95 %: un colchón sacado de días pasados se queda corto. El horario oficial se queda corto (mediana observada mayor
  que la programada) en el 37 % de los pares zonales y en el 60 % de los duales.

- **Accesibilidad al empleo** (580 zonas de la EM2023, salidas de 6:30 a 8:30, empleo aproximado con los viajes a
  trabajar): según el horario, desde una zona de estrato 1 se alcanza el 11 % de los empleos en 60 min y desde una de
  estrato 4 el 51 %. El horario subestima el día típico (+16 % en la mediana con los tiempos observados), pero en un
  día lento (p80 de cada tramo) los estratos 1 y 2 pierden 11 % a 14 % frente al horario y los estratos 4 a 6 solo 3 %
  a 5 % (`resultados/accesibilidad.json`).

## Rendimiento

Escalamiento fuerte sobre el lunes 23 de noviembre (1.437 capturas, 309 MB) en un portátil i5-10210U (4 núcleos, 8
hilos, 11 GB). Todas las configuraciones producen exactamente las mismas filas.

| | Secuencial | Ray 1 | Ray 2 | Ray 4 | Ray 8 |
|---|---|---|---|---|---|
| Total (s) | 1.196 | 1.124 | 736 | 559 | 432 |
| Speedup | 1,00× | 1,06× | 1,62× | 2,14× | 2,77× |

Ajuste de Amdahl: p ≈ 0,73. El ETL no escala (unos 30 s con cualquier número de workers: E/S y costo de Ray Data); lo
que escala son los recorridos (625 → 199 s) y la confiabilidad (525 → 197 s). Por encima de 4 workers solo se gana
con hyperthreading. En el proyecto 3 cada actor de Ray es una JVM con la red R5 completa: en este portátil cabe uno
(unos 7,5 min por escenario); el límite es la memoria, no los núcleos.

## Validación

- **Trayectorias sintéticas** muestreadas cada 52 s con ±10 m de ruido: el tiempo por tramo tiene un sesgo agregado de
  +0,5 % y un error mediano de 8,4 % (p90 21,8 %). Sirve para comparar tramos y horas, no un tramo aislado.
- **Magnitudes:** la velocidad comercial queda entre 10 % y 18 % por debajo de la oficial de 2024.
- **Estabilidad:** el ranking de la primera mitad de los días hábiles frente a la segunda tiene un Spearman de 0,63
  (mixto) y 0,75 (exclusivo); 10 y 12 de las 20 peores celdas se repiten.
- **Calidad del feed** (`resultados/calidad.csv`): entre 22 % y 31 % de los reportes son duplicados; el feed pasa de
  unos 6.400 a unos 8.400 buses después del 18 de noviembre, y algunas mañanas no trae datos hasta las 7 a 9 h.

## Datos

- Posiciones: archivo del feed en [`Fozzy3/parallel-computing-final`](https://github.com/Fozzy3/parallel-computing-final).
  `datos/listar.py` arma la lista de capturas de unos días de servicio y `datos/bajar.sh` las baja.
- GTFS estático de TransMilenio (`datos/gtfs/GTFS.zip`, el del 26 de noviembre; el diario no está en GitHub).
- `datos/carriles.csv`: la Séptima y la Carrera 13 entre sus calles límite, tomadas de OpenStreetMap.
- Proyecto 3: Encuesta de Movilidad 2023 del Observatorio de Movilidad (`datos/em2023/`, la página no declara
  licencia) y el recorte OSM de Bogotá de BBBike (`datos/osm/`).

La limpieza viene de `4.ProyectoFinal` (zombis de más de 5 min, duplicados, día de servicio en hora de Bogotá). Lo
nuevo: cada ruta tiene un solo shape y muchas van y vuelven por la misma calle, así que el bus se empareja solo con
los segmentos que van en su sentido de marcha; la pasada se corta si el bus avanza más de 90 km/h, retrocede más de
200 m o pasa más de 10 min detenido; y un par de paradas que da la vuelta (más del doble de la distancia en línea
recta) no cuenta.

## Pipeline

| Etapa | Qué hace | Ray |
|---|---|---|
| `etl` | `.pb.gz` → Parquet por (día, `crc32(vehicle_id) % 64`) | Ray Data |
| `recorridos` | emparejar cada bus con su ruta, cortar pasadas, tiempo por tramo de 500 m | una tarea por día × partición; geometrías en el object store |
| `tramos` | velocidad y retraso por ruta, tramo, tipo de día y hora | una tarea por cubo de rutas (32) |
| `confiabilidad` | tiempos en paradas, pares, percentiles, horario, walk-forward | una tarea por cubo de rutas |

Corrida completa en local (6 núcleos): etl 5 min, recorridos 32 min, tramos 32 s, confiabilidad 20 min.

## Correr

```bash
cd pipeline && uv sync && uv run pytest -q
DIAS=2026-11-12,...,2026-11-23
uv run python pipeline.py --raw ../datos/raw --gtfs ../datos/gtfs/GTFS.zip --dias $DIAS \
    --out ../datos/salida/completo --modo ray --cpus 8 --tiempos ../resultados/tiempos.jsonl
uv run python calidad.py --out ../datos/salida/completo --resultados ../resultados
uv run python metricas.py --out ../datos/salida/completo --gtfs ../datos/gtfs/GTFS.zip --resultados ../resultados
setsid nohup ./bench_local.sh &      # escalamiento fuerte: secuencial y Ray con 1, 2, 4 y 8 (log en ../datos/salida/bench.log)
uv sync --group acceso                # proyecto 3: r5py (Java 21+)
uv run python accesibilidad.py --gtfs ../datos/gtfs/GTFS.zip --osm ../datos/osm/Bogota.osm.pbf --em ../datos/em2023 \
    --resultados ../resultados --trabajo ../datos/salida/acceso --actores 1 --memoria 3G
```

El cuaderno `proyecto_final.ipynb` lee `resultados/` y ya viene ejecutado:
`uv run --project pipeline --with jupyter --with matplotlib jupyter lab proyecto_final.ipynb`.

`--modo secuencial` corre el mismo trabajo en un proceso: es la línea base del speedup. El benchmark en Colab está en
`pipeline/colab/bench_colab.sh`.

## Presentación

```bash
cd pipeline && uv run --with pyarrow python ../presentacion/scripts/exportar_datos.py   # src/datos.json
cd ../presentacion && npm install && npm run dev
```

Teclas: `→`/espacio avanza, `←` retrocede, `1`–`4` capítulos, `O` vista de la ruta, `N` notas, `T` tema, `G` guion.
Se publica en GitHub Pages en `/4.1/` con cada push que toque `presentacion/`.
