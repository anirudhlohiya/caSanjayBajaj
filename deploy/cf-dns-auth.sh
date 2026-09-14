#!/usr/bin/env bash
# certbot --manual-auth-hook: place _acme-challenge.<domain> TXT via Cloudflare API.
set -euo pipefail
ZONE="${CF_ZONE:-03969891186fb0b2408edb5e696165ba}"
TOKEN="$(sudo chmod 640 /etc/letsencrypt/cloudflare.ini && sudo cat /etc/letsencrypt/cloudflare.ini)"
NAME="_acme-challenge.${CERTBOT_DOMAIN}"

echo "cf-dns-auth: placing TXT $NAME = ${CERTBOT_VALIDATION}"
RESPONSE="/etc/letsencrypt/cf-auth-response-${CERTBOT_DOMAIN}.json"
REC="$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "{\"type\":\"TXT\",\"name\":\"${NAME}\",\"content\":\"${CERTBOT_VALIDATION}\",\"ttl\":120}")"
printf '%s' "$REC" > "$RESPONSE"
echo "$REC" | grep -q '"success":true' || { echo "cf-dns-auth: Cloudflare rejected record create"; cat "$RESPONSE"; exit 1; }

python3 -c "import json,sys;print(json.load(open('$RESPONSE'))['result']['id'])" > "/etc/letsencrypt/cf-record-${CERTBOT_DOMAIN}"
sleep 20
echo "cf-dns-auth: done"