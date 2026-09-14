#!/usr/bin/env bash
# Bootstrap an AWS Lightsail instance (Amazon Linux 2023) exactly like the
# existing EC2 host, so the app can be cut over to Lightsail with no layout
# changes. It delegates to the canonical bootstrap-server.sh (system packages,
# swap, Node 22, Postgres 16, Nginx, certbot, LibreOffice, repo clone, symlink,
# backup cron) and then prints the Lightsail-only cutover steps.
#
# Usage on the new Lightsail instance:
#   sudo bash bootstrap-lightsail.sh '<DB_PASSWORD>'
#
# After this completes you still need to: copy the .env over from the old host,
# restore the database, deploy once, and flip DNS (checklist printed at the end).
set -euo pipefail

DB_PASSWORD="${1:?Usage: sudo bash bootstrap-lightsail.sh <DB_PASSWORD>}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== delegating to bootstrap-server.sh (identical OS setup) =="
bash "$SCRIPT_DIR/bootstrap-server.sh" "$DB_PASSWORD"

echo "== Lightsail cutover checklist =="
cat <<'NEXT'

Lightsail bootstrap done. Your app layout now matches the old EC2 host:
  - /opt/ca-app/repo        (repo clone + backend symlink)
  - /opt/ca-app/backend/.env  (NOT created - copy it from the old server now)
  - Nginx, Postgres 16, PM2, LibreOffice all installed.

Remaining cutover steps (see docs/11-lightsail-migration-runbook.md):
  1.  scp -i lightsail-key.pem backend/.env ec2-user@<NEW-IP>:/opt/ca-app/backend/.env
  2.  Restore the database from the latest S3 backup (or a fresh pg_dump
      taken at cutover from the old host). The runbook has the exact commands.
  3.  Deploy once via CI (or deploy-from-local.ps1) to install node_modules +
      run migrations + build dist.
  4.  sudo certbot --nginx -d snbajaj.com
  5.  Flip the Cloudflare A record from the old EC2 IP to the Lightsail static IP.
  6.  Verify https://snbajaj.com + /admin/, then terminate the old EC2 instance.
NEXT