#!/usr/bin/env bash
# Nightly Postgres backup -> S3 (server-side encrypted).
#
# One-time install on the server:
#   sudo install -D -m 700 -o ec2-user -g ec2-user deploy/backup.sh /opt/ca-app/bin/backup.sh
#   mkdir -p /opt/ca-app/backups
#   crontab -e   add:   30 2 * * * /opt/ca-app/bin/backup.sh >> /opt/ca-app/backups/cron.log 2>&1
#
# Also create an S3 lifecycle rule (console): expire objects under postgres/ after 30 days.
set -euo pipefail

BACKEND_DIR=/opt/ca-app/backend
BACKUP_DIR=/opt/ca-app/backups
KEEP_LOCAL_DAYS=3

get_env() { grep -E "^${1}=" "$BACKEND_DIR/.env" | tail -n1 | cut -d= -f2-; }

BUCKET=$(get_env S3_BACKUP_BUCKET)
[ -n "$BUCKET" ] || { echo "S3_BACKUP_BUCKET missing in $BACKEND_DIR/.env" >&2; exit 1; }
export AWS_REGION="$(get_env AWS_REGION)"
export AWS_ACCESS_KEY_ID="$(get_env AWS_ACCESS_KEY_ID)"
export AWS_SECRET_ACCESS_KEY="$(get_env AWS_SECRET_ACCESS_KEY)"

STAMP=$(date +%Y-%m-%d_%H%M%S)
mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/ca_sanjay_gst_${STAMP}.sql.gz"

sudo -u postgres pg_dump ca_sanjay_gst | gzip > "$OUT"

aws s3 cp "$OUT" "s3://${BUCKET}/postgres/${STAMP}.sql.gz" --sse AES256

find "$BACKUP_DIR" -name 'ca_sanjay_gst_*.sql.gz' -mtime "+${KEEP_LOCAL_DAYS}" -delete
echo "backup ok: ${STAMP}"
