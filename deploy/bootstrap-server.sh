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
mkdir -p /opt/ca-app/frontend/site/admin /opt/ca-app/bin
chown -R ec2-user:ec2-user /opt/ca-app

echo "== [6/6] services =="
systemctl enable --now nginx crond

cat <<'NEXT'

Bootstrap complete. Remaining manual steps:
  1. Point DNS A record of your domain at this instance's public IP.
  2. Clone repo:   git clone https://github.com/anirudhlohiya/caSanjayBajaj.git /opt/ca-app/backend
  3. Create /opt/ca-app/backend/.env from backend/.env.example (NODE_ENV=production,
     DB_PASSWORD=<the password used above>, CORS_ORIGIN=https://<DOMAIN>, real AWS keys).
  4. First deploy from Windows: deploy/deploy-from-local.ps1 -Server ec2-user@<DOMAIN>
  5. TLS:        sudo certbot --nginx -d <DOMAIN>
  6. Backups:    install cron line from deploy/backup.sh header.
NEXT
