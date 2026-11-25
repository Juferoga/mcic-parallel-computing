# Pipeline en Ray

Mismo trabajo en dos modos: **secuencial** (un proceso, sin Ray: la línea base) y **Ray**. La lógica está en
`tm/nucleo.py`; `pipeline.py` solo decide cómo se reparte.

| Etapa | Qué hace | Paralelismo en Ray |
|---|---|---|
| `etl` | `.pb.gz` → filas (filtra reportes con más de 5 min: zombis) → Parquet particionado por `dia` y `parte = crc32(vehicle_id) % 64` | **Ray Data**: `read_binary_files` + `map_batches` + `write_parquet`. El shuffle por vehículo se hace al escribir |
| `trayectorias` | por partición: ordenar cada bus, deduplicar `(vehicle_id, ts)`, **map-matching** contra la geometría de su ruta (`shapes.txt`), velocidad (Δs/Δt) y llegadas a parada | **Ray Core**: una tarea `@ray.remote` por partición; las geometrías se suben una vez con `ray.put` y cada tarea recibe la referencia (object store) |
| `headways` | por día: llegadas a cada parada de cada ruta → intervalo entre buses consecutivos | Ray Core: una tarea por día |

`metricas.py` reduce las salidas a `../resultados/metricas.json`: velocidad comercial (Σdistancia/Σtiempo)
por hora, por tipo de servicio y por día; velocidad por tramo de 500 m de las troncales en el pico; headway y
bunching (intervalo < 25 % de la mediana de esa ruta y parada).

## Correr

```bash
uv sync
uv run python pipeline.py --raw ../datos/raw --gtfs ../datos/gtfs/GTFS.zip --dias 2026-11-17 \
    --out /tmp/tm --modo ray --cpus 8 --tiempos ../resultados/tiempos.jsonl
uv run python metricas.py --out /tmp/tm --gtfs ../datos/gtfs/GTFS.zip --json ../resultados/metricas.json
```

`--dias` son días de servicio en hora de Bogotá; el script toma las capturas de las dos carpetas UTC que los
cubren. `./correr_local.sh` compara secuencial, Ray 8 y Ray 2 sobre la muestra local.

## Benchmark en Colab

`colab/bench_colab.sh` corre en una VM de Colab (CPU High-RAM, 8 vCPU, 50 GB):

1. **Escalamiento fuerte:** el martes 17 completo, secuencial y Ray con 1, 2, 4 y 8 workers.
2. **Volumen:** 8 workers con 3 días hábiles y con los 14 días. La salida de 14 días alimenta `metricas.py`.

```bash
tar czf /tmp/pipeline.tgz --exclude .venv -C .. pipeline
colab new -s tmcpu --high-mem
colab upload -s tmcpu /tmp/pipeline.tgz /content/pipeline.tgz
echo 'import subprocess; subprocess.run("cd /content && tar xzf pipeline.tgz && nohup bash pipeline/colab/bench_colab.sh > bench.out 2>&1 &", shell=True)' | colab exec -s tmcpu
# al terminar (/content/res/log.txt dice TERMINADO):
colab download -s tmcpu /content/res/tiempos.jsonl ../resultados/tiempos.jsonl
colab download -s tmcpu /content/res/metricas.json ../resultados/metricas.json
colab stop -s tmcpu
```

Después, `presentacion/scripts/exportar_datos.py` arma `benchmark.json` y lleva todo a la presentación.

## Decisiones

- **Por qué no `groupby().map_groups()` de Ray Data para las trayectorias:** con un pool de actores que pedía
  los 8 CPU, el shuffle de Ray Data se quedaba sin núcleos y la prueba local pasó de 1 min a más de 10. Partir
  por hash al escribir (un shuffle del lado de quien escribe) y usar tareas de Ray Core es más simple, más rápido
  y deja ver el object store.
- **Velocidad comercial = Σdistancia / Σtiempo**, no la mediana de velocidades instantáneas: un bus detenido en una
  estación aporta muchos ceros y la mediana daba ~0 km/h en los tramos con paradas.
- **Las geometrías son las del GTFS del 24 de noviembre.** `route_id` cruza al 95–100 % con todos los días;
  `trip_id` no (ver `../docs/evaluacion-archivador.md`).
