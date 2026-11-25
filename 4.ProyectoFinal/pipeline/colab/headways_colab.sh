#!/bin/bash
# Rehace solo la etapa 3 (headways en puntos de control) sobre las salidas de bench_colab.sh y recalcula métricas.
set -u
cd /content/pipeline
GTFS=/content/GTFS.zip; RES=/content/res
log() { echo "$(date -u +%FT%TZ) $*" >> $RES/log.txt; }
P() { python pipeline.py --raw /content/datos/raw --gtfs $GTFS --tiempos $RES/tiempos.jsonl --etapas headways "$@" >> $RES/corridas.txt 2>&1; log "fin hw $* (rc=$?)"; }
# Escalamiento de la etapa 3 sobre el martes 17 (las trayectorias de ese día, enlazadas desde la corrida completa).
mkdir -p /content/d17/trayectorias && ln -sfn /content/completo/trayectorias/dia=2026-11-17 /content/d17/trayectorias/dia=2026-11-17
P --dias 2026-11-17 --out /content/d17 --modo secuencial --cpus 1 --etiqueta fuerte-hw
for n in 1 2 4 8; do P --dias 2026-11-17 --out /content/d17 --modo ray --cpus $n --etiqueta fuerte-hw; done
P --dias 2026-11-11 --out /content/completo --modo ray --cpus 8 --etiqueta volumen-hw
python metricas.py --out /content/completo --gtfs $GTFS --json $RES/metricas.json >> $RES/corridas.txt 2>&1
log "metricas rc=$?"
log "TERMINADO-HW"
