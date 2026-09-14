#!/usr/bin/env bash
# One-time EC2 bootstrap — Amazon Linux 2023 (t3.micro/t2.micro).
# Usage:  sudo bash bootstrap-server.sh '<DB_PASSWORD>'
# Run this ONCE on a fresh instance, before the first deploy-from-local.ps1 run.
set -euo pipefail

DB_PASSWORD="${1:?Usage: sudo bash bootstrap-server.sh <DB_PASSWORD>}"

echo "== [1/6] swap (t3.micro has 1GB RAM; builds need headroom) =="
if ! swapon --show=NAME | grep -q '^/swapfile$'; then
  dd if=/dev/zero of=/swapfile bs=128M count=16 status=none
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "== [2/6] system packages =="
dnf update -y
dnf install -y git nginx rsync awscli cronie \
               postgresql16-server postgresql16 postgresql16-contrib \
               certbot python3-certbot-nginx

echo "== [3/6] Node.js 22 + PM2 =="
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs
npm install -g pm2@latest

echo "== [4/6] PostgreSQL 16 init + local auth =="
postgresql-setup --initdb
PGHBA=/var/lib/pgsql/data/pg_hba.conf
sed -i "1i host    ca_sanjay_gst    postgres    127.0.0.1/32    scram-sha-256" "$PGHBA"
systemctl enable --now postgresql
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "ALTER USER postgres PASSWORD '${DB_PASSWORD}';"
if ! sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='ca_sanjay_gst'" | grep -q 1; then
  sudo -u postgres createdb ca_sanjay_gst
fi

echo "== [5/6] app layout =="
mkdir -p /opt/ca-app/frontend/site/admin /opt/ca-app/bin /opt/ca-app/backups
chown -R ec2-user:ec2-user /opt/ca-app

echo "== [5b/6] clone repo + backend symlink =="
if [ ! -d /opt/ca-app/repo/.git ]; then
  sudo -u ec2-user git clone https://github.com/anirudhlohiya/caSanjayBajaj.git /opt/ca-app/repo
fi
if [ ! -L /opt/ca-app/backend ]; then
  ln -s /opt/ca-app/repo/backend /opt/ca-app/backend
fi
chown -R ec2-user:ec2-user /opt/ca-app/repo

echo "== [5c/6] nightly backup cron =="
install -D -m 700 -o ec2-user -g ec2-user /opt/ca-app/repo/deploy/backup.sh /opt/ca-app/bin/backup.sh
( crontab -u ec2-user -l 2>/dev/null | grep -v 'backup.sh' ; echo '30 2 * * * /opt/ca-app/bin/backup.sh >> /opt/ca-app/backups/cron.log 2>&1' ) | crontab -u ec2-user - || true

echo "== [6/6] services =="
systemctl enable --now nginx crond

echo "== [7/7] LibreOffice (headless DOCX->PDF) =="
INSTALLER="$(dirname "${BASH_SOURCE[0]}")/install-libreoffice.sh"
if [ -f "$INSTALLER" ]; then
  bash "$INSTALLER" || echo "WARNING: LibreOffice install failed; PDF preview disabled until fixed."
else
  echo "install-libreoffice.sh not found next to bootstrap-server.sh - skipping (PDF preview disabled)."
fi

cat <<'NEXT'

Bootstrap complete. Remaining manual steps:
  1. Point DNS A record of your domain at this instance's public IP.
  2. Create /opt/ca-app/backend/.env from backend/.env.example  (npm run seed for super admin).
     In production set NODE_ENV=production, DB_PASSWORD=<the password used above>,
     CORS_ORIGIN=https://<DOMAIN>, real AWS keys, LIBREOFFICE_ENABLED=true.
  3. Deploy:   deploy/deploy-from-local.ps1 -Server ec2-user@<DOMAIN>
     or push to main and let .github/workflows/deploy.yml run.
  4. TLS:      sudo certbot --nginx -d <DOMAIN>
NEXT
