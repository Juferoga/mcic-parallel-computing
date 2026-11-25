# Evaluación del archivador GTFS-RT (`Fozzy3/parallel-computing-final`)

Revisión del 24 de noviembre de 2026 sobre `archivar_tm.sh`, `subir_tm.sh`, `crontab_tm.txt` y una muestra de
739 capturas reales (una por media hora de cada día y todas las del 17 de noviembre de 6:00 a 8:00, hora de Bogotá).
Los números se pueden reproducir con `presentacion/scripts/exportar_datos.py`.

**Veredicto:** el archivador está bien hecho para lo que promete (no perder capturas) y **no hay que tocarlo antes de
la entrega**. Sus fallas son de *detección*, no de *captura*: todo lo que se ve mal se corrige en el ETL. Los
cambios de abajo quedan para después de la entrega, si se quiere seguir archivando.

## Lo que está bien

- `cron` cada minuto + `flock -n`: se recupera solo de caídas y reinicios, y nunca corre dos veces.
- Escritura atómica (`.part` → `mv`) y `.last` actualizado solo después del `mv`: un corte no deja archivos a medias.
- Reintentos de `curl` (`--retry 2 --retry-all-errors`) y registro de fallas en `eventos.log`.
- Guarda solo cuando el archivo cambia, y el GTFS estático solo cuando `manifest.json` anuncia una versión nueva.
- Los huecos que detecta están documentados en el README.

## Hallazgos (de más a menos grave)

| # | Hallazgo | Evidencia | Impacto | Qué hacer ahora | Arreglo de fondo (después) |
|---|---|---|---|---|---|
| 1 | **El GTFS estático solo se guarda desde el 24 de nov y los `trip_id` cambian cada día** | Solo el 2,6 % de los `trip_id` del 12 al 17 existen en el GTFS del 24; `route_id` cruza al 95–100 % y `stop_id` al 96–99 % | No se puede comparar contra el horario (`stop_times`) del 11 al 23 | Analizar por ruta y parada; el headway se compara contra la mediana observada | Ya está resuelto hacia adelante: guarda el GTFS cada día. Falta respaldarlo fuera de la VM (pesa 118 MB, no cabe en GitHub) |
| 2 | **Congelamiento detectado por bytes, no por contenido** | Del 18 nov 17:30 al 19 nov ~10:00 (Bogotá) el feed entregó siempre 7 buses con reportes de hasta 13 días. Como el encabezado cambia, `cmp` lo toma como captura nueva. No aparece en la tabla de huecos del README | Un episodio de ~16 h que pasa por bueno | Filtrar en el ETL: `header.timestamp − vehicle.timestamp < 300 s` | Registrar «congelado» cuando la cantidad de buses frescos cae por debajo de un umbral en horario de servicio. El aviso de «casi vacío» (< 20 KB) existe solo desde el 24 |
| 3 | **Los datos viven en git** | 44.363 archivos y 4,07 GB; crece entre 200 y 390 MB por día | GitHub pone el límite blando en 5 GB (unos días más); clonar es lento; el historial nunca se encoge | No usarlo como submódulo; bajar solo lo necesario (`datos/bajar.sh`) | Empaquetar un tar por día y publicarlo como Release, o en Hugging Face o Zenodo. Mejor aún, publicar el Parquet ya limpio |
| 4 | **Carpetas por fecha UTC** | El día de servicio de Bogotá (05:00–23:59, UTC−5) cruza dos carpetas: de 19:00 a 23:59 cae en la carpeta del día siguiente | Es fácil leer mal los huecos; nos pasó en la primera revisión | Asignar el día de servicio con la hora de Bogotá en el ETL | Documentarlo en el README o particionar por día de servicio |
| 5 | **Capturas repetidas** | En la ventana del 17 (6:15–7:45) el 16,8 % de los reportes leídos son repetidos y 20 de 123 capturas no traen nada nuevo. Cada bus da un dato nuevo cada ~52 s | Ocupa espacio, nada más | Deduplicar por `(vehicle_id, timestamp)` | Comparar el contenido decodificado en vez de los bytes, o aceptar el costo |
| 6 | **Hora del archivo = hora de descarga** | El nombre usa `date -u` del servidor, no `header.timestamp` | Desfase de segundos; puede mover una captura de carpeta cerca de medianoche UTC | Usar `header.timestamp` y `vehicle.timestamp` en el análisis | Nombrar con `header.timestamp` |
| 7 | **Un ciclo lento frena todo** | `curl -m 20` con 2 reintentos puede bloquear el bucle ~60 s | Se pierden capturas mientras tanto (alertas y posiciones van en el mismo bucle) | Nada | Separar posiciones y alertas en procesos distintos |
| 8 | **Un solo punto de falla** | Un servidor; el respaldo es el `git push` diario, y el GTFS no se respalda | Si la VM muere, se pierde el día en curso y todos los GTFS | Nada | Segundo archivador en otra máquina o subida cada hora |

## Hallazgo del feed (no del archivador)

| # | Hallazgo | Evidencia | Impacto | Qué se hizo |
|---|---|---|---|---|
| 9 | **El `stop_id` no se actualizaba antes del 18 de nov a mediodía** | Porcentaje de reportes en que el bus cambia de parada: 0,4 % del 11 al 17; desde el 18 (entre las 8 y las 16 h), ~40 %. El mismo día el cruce de `trip_id` con el GTFS sube de 2,6 % a 14 % | Los headways por parada daban medianas absurdas (~2,6 h) en los días hábiles de referencia | El headway se mide en puntos de control cada 1 km sobre la ruta, interpolando el cruce con la distancia del map-matching. No depende del `stop_id` |

## Descartado

- Pasar la consulta de 20 s a 10 s no aporta datos nuevos (cada bus reporta cada ~52 s) y solo genera más repetidos.
  Tampoco hace daño.
- `stat -c` y `date -d @` son de GNU: está bien porque corre en Linux, pero el script no funciona en macOS.
