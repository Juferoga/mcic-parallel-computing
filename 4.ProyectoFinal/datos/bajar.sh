#!/bin/bash
# Baja a datos/raw los archivos listados (rutas del repo Fozzy3/parallel-computing-final), en paralelo.
cd "$(dirname "$0")"
xargs -P 16 -I{} sh -c 'f=raw/${1#raw/}; [ -s "$f" ] || { mkdir -p "$(dirname "$f")"; curl -sfL -o "$f" "https://raw.githubusercontent.com/Fozzy3/parallel-computing-final/main/$1"; }' _ {} < "${1:-muestra.txt}"
