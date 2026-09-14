#!/usr/bin/env bash
# Install the app's nginx config on an AL2023 host (EC2 or Lightsail).
#
# Copies deploy/nginx-ca-platform.conf (which serves the app./admin./api.
# subdomains) into place, replaces the stock nginx.conf (whose welcome-page
# server would squat on :80 default_server and conflict with ours), then
# reloads nginx.
#
# Usage (on the server, as root):
#   sudo bash deploy/configure-nginx.sh
set -euo pipefail

REPO=/opt/ca-app/repo
NGINX_CONF=/etc/nginx/conf.d/ca-platform.conf

echo "== writing $NGINX_CONF (serves app./admin./api. subdomains) =="
sudo cp "$REPO/deploy/nginx-ca-platform.conf" "$NGINX_CONF"

echo "== replacing stock nginx.conf (avoid :80 default_server clash) =="
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
cat > /etc/nginx/nginx.conf <<'NGINX'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" "$http_user_agent"';
    access_log /var/log/nginx/access.log main;

    sendfile on;
    tcp_nopush on;
    types_hash_max_size 4096;

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    include /etc/nginx/conf.d/*.conf;
}
NGINX

echo "== testing + reloading =="
sudo nginx -t
sudo systemctl reload nginx
echo "nginx configured (app.snbajaj.com / admin.snbajaj.com / api.snbajaj.com)"