#!/bin/bash
# Escalamiento fuerte en local: el mismo día hábil completo en modo secuencial y con Ray de 1 a 8 workers.
# Registro en ../resultados/tiempos.jsonl (etiqueta "fuerte-local"); avance en ../datos/salida/bench.log.
# Uso: ./bench_local.sh [dia] [configs]   p. ej. ./bench_local.sh 2026-11-23 "ray1 ray2 ray4 ray8"
# Para que sobreviva al cierre de la terminal: setsid nohup ./bench_local.sh ... > /dev/null 2>&1 &
set -u
cd "$(dirname "$0")"
DIA=${1:-2026-11-23}
CONFIGS=${2:-"secuencial ray1 ray2 ray4 ray8"}
LOG=../datos/salida/bench.log
export TM_OBJ_STORE=${TM_OBJ_STORE:-1073741824}  # 1 GB: el PC tiene 11 GB
for c in $CONFIGS; do
    if [ "$c" = secuencial ]; then a=(--modo secuencial --cpus 1); else a=(--modo ray --cpus "${c#ray}"); fi
    echo "$(date +%T) inicio $c" >> $LOG
    uv run python pipeline.py --raw ../datos/raw --gtfs ../datos/gtfs/GTFS.zip --dias "$DIA" \
        --out ../datos/salida/bench --tiempos ../resultados/tiempos.jsonl --etiqueta fuerte-local "${a[@]}" \
        >> $LOG 2>&1
    echo "$(date +%T) fin $c (rc=$?) mem usada: $(free -m | awk 'NR==2{print $3}') MB" >> $LOG
done
echo "$(date +%T) TERMINADO" >> $LOG
