#!/bin/bash
# Benchmark oficial en una VM de Colab (CPU High-RAM, 8 vCPU), como en 4.ProyectoFinal. Deja todo en /content/res.
# Avance en /content/res/log.txt; termina con la línea TERMINADO.
#
#   tar czf /tmp/pipeline41.tgz --exclude .venv -C .. pipeline        # desde 4.1.ProyectoFinal/pipeline
#   (subir pipeline41.tgz a /content en Colab y en una celda:)
#   !cd /content && tar xzf pipeline41.tgz && nohup bash pipeline/colab/bench_colab.sh > bench.out 2>&1 &
#   (al terminar, bajar /content/res/tiempos.jsonl a ../resultados/tiempos_colab.jsonl)
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

# 1) Escalamiento fuerte: el mismo día hábil completo (lunes 23) en secuencial y con Ray de 1 a 8 workers.
DIA=2026-11-23
P --dias $DIA --out /content/tmp --modo secuencial --cpus 1 --etiqueta fuerte
for n in 1 2 4 8; do P --dias $DIA --out /content/tmp --modo ray --cpus $n --etiqueta fuerte; done

# 2) Volumen: 8 workers con 1, 5 y 12 días (12 al 23 de noviembre).
dias() { python -c "from datetime import date,timedelta as t;print(','.join(str(date(2026,11,12)+t(i)) for i in range($1)))"; }
P --dias $(dias 5) --out /content/tmp --modo ray --cpus 8 --etiqueta volumen
P --dias $(dias 12) --out /content/completo --modo ray --cpus 8 --etiqueta volumen
log "TERMINADO"
