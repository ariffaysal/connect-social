#!/usr/bin/env bash
#
# ConnectSocial backup: MySQL dump + uploaded-image archive.
#
# It talks to the running compose stack, so it needs the same project directory
# (and therefore the same .env) that `docker compose` uses.
#
# Install as a nightly cron job on the server:
#
#   chmod +x deploy/backup.sh
#   crontab -e
#   15 3 * * * /opt/connectsocial/deploy/backup.sh >> /var/log/connectsocial-backup.log 2>&1
#
# Environment overrides:
#   PROJECT_DIR   compose project directory (default: parent of this script)
#   BACKUP_DIR    where archives are written (default: $PROJECT_DIR/backups)
#   RETAIN_DAYS   delete archives older than this many days (default: 7)
#
# Restore (into a fresh stack):
#   gunzip < backups/db-<stamp>.sql.gz | docker compose exec -T mysql \
#     sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"'
#   docker compose exec -T api sh -c 'tar -xzf - -C "$UPLOAD_DIR"' \
#     < backups/uploads-<stamp>.tar.gz

set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_DIR/backups}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

cd "$PROJECT_DIR"
mkdir -p "$BACKUP_DIR"

db_file="$BACKUP_DIR/db-$STAMP.sql.gz"
uploads_file="$BACKUP_DIR/uploads-$STAMP.tar.gz"
db_tmp="$db_file.part"
uploads_tmp="$uploads_file.part"

# Archives are written to *.part files and renamed only on success, so a failed
# run can never leave a truncated file that looks like a valid backup.
cleanup() {
  rm -f "$db_tmp" "$uploads_tmp"
}
trap cleanup EXIT

echo "[$(date -Is)] Backing up database -> $db_file"
docker compose exec -T mysql sh -c \
  'exec mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" --single-transaction --no-tablespaces "$MYSQL_DATABASE"' \
  | gzip > "$db_tmp"
mv "$db_tmp" "$db_file"

echo "[$(date -Is)] Backing up uploaded images -> $uploads_file"
docker compose exec -T api sh -c 'tar -czf - -C "$UPLOAD_DIR" .' > "$uploads_tmp"
mv "$uploads_tmp" "$uploads_file"

echo "[$(date -Is)] Removing archives older than $RETAIN_DAYS days"
find "$BACKUP_DIR" -maxdepth 1 -type f \
  \( -name 'db-*.sql.gz' -o -name 'uploads-*.tar.gz' \) \
  -mtime +"$RETAIN_DAYS" -delete

echo "[$(date -Is)] Done:"
ls -lh "$db_file" "$uploads_file"
