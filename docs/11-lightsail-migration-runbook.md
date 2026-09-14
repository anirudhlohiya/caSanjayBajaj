# 11 — Lightsail Migration Runbook

Move the app from the EC2 `t3.micro` host to an AWS Lightsail bundle so the
ongoing cost is flat and predictable (~$7/mo) instead of (EC2 + EBS + public
IPv4) ~$13/mo. The stack stays identical: one instance runs Nginx, Node+PM2,
PostgreSQL 16 and (now) headless LibreOffice.

Only the instance is re-provisioned. Data and DNS are moved:

```
Cloudflare A record (snbajaj.com)
        │  cutover: point from old EC2 public IP to Lightsail static IP
        ▼
Lightsail instance (Linux/Nginx → :3000 API, /admin/, /)
        ├── S3 ca-sanjay-gst-docs      (unchanged, app files)
        ├── S3 ca-sanjay-backups       (unchanged, nightly pg_dump)
        └── SES                       (unchanged)
```

## 1. IAM (one time)

Attach the managed policy **`AmazonLightsailFullAccess`** to IAM user
`ca-backend` in your main account (`175865097334`).

- Do **not** use `LightsailExportAccess` — that policy is only for database
  snapshot export, it cannot create/manage instances.
- Read-only alternative `AmazonLightsailReadOnlyAccess` is fine for inspection
  but not for the cutover (we create an instance + static IP + key pair).

Verify locally:

```powershell
aws lightsail get-instances --region ap-south-1
aws sts get-caller-identity
```

The CLI is already installed on the dev box with the `ca-backend` credentials.

## 2. Provision Lightsail (from the dev box)

Plan: **1 GB** bundle `medium_2_0` (`$7/mo`, 2 vCPU, 40 GB SSD, 2 TB transfer,
static IP included). Do not pick an IPv6-only bundle — the app needs a public
IPv4 for the A record.

```powershell
# 1) SSH key pair (Lightsail-specific; save the .pem locally)
aws lightsail create-key-pair --key-pair-name ca-platform --region ap-south-1 `
  --output text --query 'privateKeyBase64' | Out-File -Encoding ascii F:\Anirudh\lightsail-key.pem

# 2) Instance (list valid image ids first to confirm the AL2023 image id)
aws lightsail get-blueprints --region ap-south-1 | Select-String 'amazon' | Select-Object -First 5
aws lightsail get-bundles --region ap-south-1 --include-inactive | Select-String 'medium_2_0' | Select-Object -First 2

aws lightsail create-instances --instance-names ca-platform `
  --availability-zone ap-south-1a `
  --blueprint-id amazon-linux-2023-2025.5.2 `
  --bundle-id medium_2_0 `
  --key-pair-name ca-platform `
  --region ap-south-1

# 3) Static IP (free while attached) + attach
aws lightsail allocate-static-ip --static-ip-name ca-platform-ip --region ap-south-1
aws lightsail attach-static-ip --static-ip-name ca-platform-ip `
  --instance-name ca-platform --region ap-south-1

# 4) Poll for running + get the IP
aws lightsail get-instance --instance-name ca-platform --region ap-south-1 `
  --query 'instance.{state:state.name, ip:publicIpAddress}'
```

## 3. Bootstrap the new host

Upload the two scripts from the repo and run:

```powershell
scp -i F:\Anirudh\lightsail-key.pem `
    deploy\bootstrap-server.sh deploy\bootstrap-lightsail.sh `
    ec2-user@<NEW-IP>:/tmp/
ssh -i F:\Anirudh\lightsail-key.pem ec2-user@<NEW-IP> "sudo bash /tmp/bootstrap-lightsail.sh '<DB_PASSWORD>'"
```

`DB_PASSWORD` = the same password in the current server `.env` (keeps migrate
simple; you can change it later). This installs everything incl. LibreOffice,
clones the repo, creates the symlink and the backup cron.

## 4. Copy secrets (.env)

The `.env` file is git-ignored, so it must be carried across by hand:

```powershell
# from old EC2 -> local
scp -i F:\Anirudh\ca-platform-key.pem ec2-user@65.0.45.190:/opt/ca-app/backend/.env F:\Anirudh\.env
# local -> new Lightsail
scp -i F:\Anirudh\lightsail-key.pem F:\Anirudh\.env ec2-user@<NEW-IP>:/opt/ca-app/backend/.env
```

Add to the new `.env` (already present in `backend/.env.example`):

```
LIBREOFFICE_ENABLED=true
```

Also add `DEPLOY_HOST`/`DEPLOY_USER`/`DEPLOY_SSH_KEY` **GitHub secrets** if you
haven't already — CI will deploy to the Lightsail IP from now on.

## 5. Database cutover (no data loss)

Take a fresh dump at cutover time (nightly S3 backups are ~02:30 UTC and might
miss the most recent testing rows):

```powershell
ssh -i F:\Anirudh\ca-platform-key.pem ec2-user@65.0.45.190 'sudo -u postgres pg_dump ca_sanjay_gst | gzip' > F:\Anirudh\cutover.sql.gz
scp -i F:\Anirudh\lightsail-key.pem F:\Anirudh\cutover.sql.gz ec2-user@<NEW-IP>:/tmp/
ssh -i F:\Anirudh\lightsail-key.pem ec2-user@<NEW-IP> `
  'gzip -dc /tmp/cutover.sql.gz | sudo -u postgres psql -v ON_ERROR_STOP=1'
```

## 6. Deploy on the new host

Push your branch to `origin/main` (CI runs `deploy.yml` automatically), or run
the local equivalent once against the new IP:

```powershell
powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<NEW-IP>
```

This installs `node_modules`, runs DB migrations, builds, extracts the SPAs and
reloads nginx + PM2. Verify:

```powershell
ssh -i F:\Anirudh\lightsail-key.pem ec2-user@<NEW-IP> 'curl -s http://127.0.0.1:3000/api/v1/health'
# and:  pm2 ls | grep ca-api   (status online)
```

## 7. TLS

```powershell
ssh -i F:\Anirudh\lightsail-key.pem ec2-user@<NEW-IP> `
  'sudo certbot --nginx -d snbajaj.com -m casnbajaj2015@gmail.com --agree-tos -n'
```

certbot persists the certificates on the instance (`/etc/letsencrypt`), so run
this **before** flipping DNS, or run it immediately after and renew at first
opportunity. Set a tls-alpn pre-check by keeping the old server serving the
challenge? No — simply flip DNS and run certbot right away; verification uses
the public DNS record.

## 8. DNS flip (Cloudflare)

1. Log in to Cloudflare → snbajaj.com → DNS.
2. Lower the proxy/TTL is default; edit the **A record** `snbajaj.com` (and
   `www` if present) → old EC2 IP → **Lightsail static IP**.
3. Keep `snbajaj.com` behind the Cloudflare orange cloud (proxy on) as today.
4. Old TTL typically 1–5 min global propagation (Orange proxy = instant).

## 9. Verify + rollback

```text
https://snbajaj.com/              client PWA loads
https://snbajaj.com/admin/        admin loads + login works
https://snbajaj.com/api/v1/health  {"status":"ok",...}
Rent agreements: list + summary cards + Preview (LibreOffice PDF) work
```

**Rollback** (any failure): flip the Cloudflare A record back to the old EC2 IP
`65.0.45.190`. The old instance is left running untouched for 7 days before
terminating — nothing about the old host changes at cutover until you terminate
it, so rollback is a DNS change only.

## 10. Cleanup old EC2 (after the 7-day rollback window)

```powershell
aws ec2 stop-instances --instance-ids i-09f7e0f0d3fc6414b --region ap-south-1
aws ec2 modify-instance-attribute --no-source-dest-check ...   # not needed here
# keep stopped 24h, then terminate (releases the public IPv4 $3.65/mo charge)
aws ec2 terminate-instances --instance-ids i-09f7e0f0d3fc6414b --region ap-south-1
```

After that, the only recurring AWS costs are:
| Item | Cost |
|---|---|
| Lightsail 1 GB bundle | $7.00/mo |
| 20 GB gp3 volume on Lightsail | included in bundle |
| Static IP | free while attached |
| S3 (two tiny buckets) | < $0.05/mo |
| SES | $0.10/email |

Expected steady-state: **~$7/mo** vs the current ~$13/mo projection.

## Notes

- Store `F:\Anirudh\lightsail-key.pem` (and the old `ca-platform-key.pem`) — the
  Lightsail key pair is needed by the deploy scripts / GitHub Actions
  (`DEPLOY_SSH_KEY` secret).
- Migrating to Lightsail does not require RDS/ECS/Route53 changes; the app has
  no other AWS dependencies.
- The GitHub Actions workflow (`.github/workflows/deploy.yml`) replaces the
  manual `deploy-from-local.ps1` flow for regular releases on `main`.