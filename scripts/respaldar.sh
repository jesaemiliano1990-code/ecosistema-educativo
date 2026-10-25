#!/usr/bin/env bash
# Respaldo diario de datos/: genera un .tar.gz, borra los de más de 14 días y, si se configura, copia fuera del servidor.
# Variables opcionales (se pueden definir en el cron o aquí):
#   APP_DIR        carpeta de la aplicación            (por defecto: la carpeta superior de este script)
#   DEST_DIR       carpeta de los respaldos            (por defecto: $HOME/respaldos)
#   RETENCION_DIAS días que se conservan               (por defecto: 14)
#   DESTINO_REMOTO destino rsync, p. ej. usuario@otro-servidor:/respaldos/ecosistema/  (vacío = no copia)
set -euo pipefail

APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DEST_DIR="${DEST_DIR:-$HOME/respaldos}"
RETENCION_DIAS="${RETENCION_DIAS:-14}"
DESTINO_REMOTO="${DESTINO_REMOTO:-}"

if [ ! -d "$APP_DIR/datos" ]; then
  echo "$(date '+%F %T') ERROR: no existe $APP_DIR/datos" >&2
  exit 1
fi

mkdir -p "$DEST_DIR"
ARCHIVO="$DEST_DIR/datos-$(date +%F).tar.gz"

# datos/respaldos ya son copias internas de la aplicación: se excluyen para no duplicar.
tar -czf "$ARCHIVO.tmp" -C "$APP_DIR" --exclude='datos/respaldos' datos
mv "$ARCHIVO.tmp" "$ARCHIVO"
chmod 600 "$ARCHIVO"
echo "$(date '+%F %T') Respaldo creado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

# Retención
find "$DEST_DIR" -maxdepth 1 -name 'datos-*.tar.gz' -mtime +"$RETENCION_DIAS" -print -delete | sed 's/^/Borrado por antigüedad: /'

# Copia fuera del servidor
if [ -n "$DESTINO_REMOTO" ]; then
  rsync -az -e "ssh -o BatchMode=yes" "$DEST_DIR"/datos-*.tar.gz "$DESTINO_REMOTO"
  echo "$(date '+%F %T') Copia enviada a $DESTINO_REMOTO"
else
  echo "AVISO: DESTINO_REMOTO está vacío; el respaldo solo existe en este servidor."
fi
