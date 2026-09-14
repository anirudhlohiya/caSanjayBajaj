#!/usr/bin/env bash
# certbot --manual-cleanup-hook: remove the _acme-challenge TXT we placed.
set -euo pipefail
ZONE="${CF_ZONE:-03969891186fb0b2408edb5e696165ba}"
TOKEN="$(sudo cat /etc/letsencrypt/cloudflare.ini 2>/dev/null || true)"
ID_FILE="/etc/letsencrypt/cf-record-${CERTBOT_DOMAIN}"

[ -f "$ID_FILE" ] || { echo "cf-dns-clean: no record id for $CERTBOT_DOMAIN; nothing to do"; exit 0; }
ID="$(cat "$ID_FILE")"
echo "cf-dns-clean: deleting DNS record $ID ($CERTBOT_DOMAIN)"
curl -sS -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE}/dns_records/${ID}" \
  -H "Authorization: Bearer ${TOKEN}" || true
rm -f "$ID_FILE" "/etc/letsencrypt/cf-auth-response-${CERTBOT_DOMAIN}.json"
echo "cf-dns-clean: done"