#!/bin/bash
# Corre en la VM de Colab (CPU High-RAM, 8 vCPU). Deja todo en /content/res. Avance en /content/res/log.txt.
set -u
cd /content/pipeline
RAW=/content/datos/raw
GTFS=/content/GTFS.zip
RES=/content/res
mkdir -p $RES
log() { echo "$(date -u +%FT%TZ) $*" >> $RES/log.txt; }

log "preparando"
pip install -q "ray[data]>=2.40" gtfs-realtime-bindings pyarrow pandas >> $RES/pip.txt 2>&1
[ -d /content/datos ] || git clone -q --depth 1 https://github.com/Fozzy3/parallel-computing-final /content/datos
[ -s $GTFS ] || curl -sfL -o $GTFS https://gtfs.transmilenio.gov.co/GTFS.zip
log "datos listos: $(du -sh /content/datos | cut -f1)"

P() { python pipeline.py --raw $RAW --gtfs $GTFS --tiempos $RES/tiempos.jsonl "$@" >> $RES/corridas.txt 2>&1; log "fin $* (rc=$?)"; }

# 1) Escalamiento fuerte: el mismo día (martes 17, completo) con 1..8 workers, más el secuencial como línea base.
DIA=2026-11-17
P --dias $DIA --out /content/tmp --modo secuencial --cpus 1 --etiqueta fuerte
for n in 1 2 4 8; do P --dias $DIA --out /content/tmp --modo ray --cpus $n --etiqueta fuerte; done

# 2) Volumen: 8 workers con 1, 3 y 14 días. La de 14 días queda como salida para las métricas.
P --dias 2026-11-12,2026-11-13,2026-11-17 --out /content/tmp --modo ray --cpus 8 --etiqueta volumen
DIAS=$(python -c "from datetime import date,timedelta as t;print(','.join(str(date(2026,11,11)+t(i)) for i in range(14)))")
P --dias $DIAS --out /content/completo --modo ray --cpus 8 --etiqueta volumen

python metricas.py --out /content/completo --gtfs $GTFS --json $RES/metricas.json >> $RES/corridas.txt 2>&1
log "metricas rc=$?"
log "TERMINADO"
