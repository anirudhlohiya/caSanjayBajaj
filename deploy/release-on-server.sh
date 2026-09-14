#!/usr/bin/env bash
# Server-side release.
#
# Extracts the frontend bundle uploaded to /tmp/frontend.tar.gz into
# /opt/ca-app/frontend/site, updates the backend from origin/main, then reloads
# nginx and the API under PM2.
#
# Shared by BOTH deploy paths so they stay in sync:
#   - GitHub Actions  .github/workflows/deploy.yml   (CI)
#   - local           deploy/deploy-from-local.ps1   (Windows dev box)
#
# Usage on the server:
#   scp frontend.tar.gz <user>@<host>:/tmp/frontend.tar.gz
#   SKIP_BACKEND=1 bash /opt/ca-app/repo/deploy/release-on-server.sh
set -euo pipefail

SITE=/opt/ca-app/frontend/site
REPO=/opt/ca-app/repo
BACKEND_DIR="$REPO/backend"
TARBALL=/tmp/frontend.tar.gz
SKIP_BACKEND=${SKIP_BACKEND:-0}

[ -f "$TARBALL" ] || { echo "missing $TARBALL - upload the frontend bundle first" >&2; exit 1; }

if [ "$SKIP_BACKEND" != "1" ]; then
  echo "== updating backend from origin/main =="
  cd "$BACKEND_DIR"
  git fetch origin
  git reset --hard origin/main
  npm ci
  npm run migration:run
  npm run build
fi

echo "== releasing frontend =="
INCOMING=/opt/ca-app/frontend/.incoming
rm -rf "$INCOMING"
mkdir -p "$INCOMING"
tar -xzf "$TARBALL" -C "$INCOMING"
mkdir -p "$SITE"
# rsync outside the web root first: a source dir nested inside the destination
# would otherwise look "extra" to rsync --delete (exit 24).
rsync -a --delete --exclude '/admin/' "$INCOMING/site/" "$SITE/"
rm -rf "$SITE/admin.old"
[ -d "$SITE/admin" ] && mv "$SITE/admin" "$SITE/admin.old"
mv "$INCOMING/admin" "$SITE/admin"
rm -rf "$SITE/admin.old" "$INCOMING" "$TARBALL"

echo "== reloading nginx + API =="
sudo nginx -t
sudo systemctl reload nginx
pm2 startOrReload "$REPO/deploy/ecosystem.config.js"
pm2 save
sleep 3
# The API just reloaded — wait for it to come up instead of failing on a
# one-shot check (NestJS boot takes a few seconds).
for i in $(seq 1 20); do
    if curl -fsS http://127.0.0.1:3000/api/v1/health > /dev/null; then
        echo "DEPLOY OK: health check passed"
        exit 0
    fi
    echo "health check $i/20: API not ready yet, retrying in 3s"
    sleep 3
done
echo "DEPLOY FAILED: API not healthy after ~60s" >&2
exit 1