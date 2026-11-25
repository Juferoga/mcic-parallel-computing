#!/bin/bash
# Prueba local: secuencial vs Ray con 8 y 2 CPU sobre la muestra de datos/raw. Uso: ./correr_local.sh SALIDA TIEMPOS
R=(uv run python pipeline.py --raw ../datos/raw --gtfs ../datos/gtfs/GTFS.zip --dias 2026-11-17 --out "$1" --tiempos "$2")
"${R[@]}" --modo secuencial --cpus 1 2>&1 | grep -E '^\{|rror' | tail -3
"${R[@]}" --modo ray --cpus 8 2>&1 | grep -E '^\{|rror' | tail -3
"${R[@]}" --modo ray --cpus 2 2>&1 | grep -E '^\{|rror' | tail -3
