# 10 — Phase 5 Deploy Runbook (single AWS EC2) + Security Checklist

> Step-by-step guide to take the platform from this repo to a live HTTPS deployment on one
> t3.micro instance. The automation lives in **`deploy/`** (see its README for the file map).
> Companion docs: `07-aws-reference.md` (AWS resources), `09-run-and-test-guide.md` (local run).

---

## 0. Architecture being deployed

```
                    ┌────────────────────────── one EC2 t3.micro (Amazon Linux 2023) ─────────┐
Browser ──HTTPS:443─▶ Nginx                                                                    │
                    │   ├── /            static  Client PWA      (/opt/ca-app/frontend/site)  │
                    │   ├── /admin/      static  Admin SPA       (/opt/ca-app/frontend/site/admin)
                    │   ├── /api/        proxy ▶ 127.0.0.1:3000  (PM2 "ca-api", node dist/main.js)
                    │   └── nightly cron ▶ backup.sh ▶ S3 ca-sanjay-backups/postgres/         │
                    │   PostgreSQL 16 (localhost only, scram-sha-256)                         │
                    └──────────────────────────────────────────────────────────────────────────┘
```

Both SPAs are built with a **relative** API base (`/api/v1`) — same origin, so CORS is
irrelevant in production. The admin app is served under `/admin/`
(built with `--base-href=/admin/`).

## 1. Prerequisites (one-time, external)

| Item | Where | Notes |
|---|---|---|
| AWS account + IAM user `ca-backend` keys | `docs/07-aws-reference.md` §2 | S3 + SES policies |
| S3 buckets `ca-sanjay-gst-docs`, `ca-sanjay-backups` | §3 | private, block-public ON |
| SES verified sender + production access requested | §4 | sandbox blocks non-verified recipients |
| VAPID keys generated | §5 | `npx web-push generate-vapid-keys` |
| A domain you control | any registrar | e.g. `snbajaj.com` |
| Key pair `.pem` downloaded once | EC2 → Key pairs | keep safe, never commit |
| From Windows: OpenSSH client working | `ssh -V` | ships with Win10/11 |

## 2. Launch the instance

1. EC2 → Launch instance:
   - AMI **Amazon Linux 2023**, type **t3.micro** (or t2.micro), region `ap-south-1`.
   - Key pair: your `.pem`.
   - **Security group inbound:** SSH 22 from *your IP only*; HTTP 80 from anywhere;
     HTTPS 443 from anywhere. Nothing else — Postgres must NOT be reachable externally.
   - Storage: 20 GB gp3 (free-tier sized).
2. Note the Public IPv4 DNS.

## 3. Bootstrap the server (once)

```powershell
scp -i <key>.pem deploy\bootstrap-server.sh ec2-user@<EC2-DNS>:/tmp/
ssh -i <key>.pem ec2-user@<EC2-DNS>
sudo bash /tmp/bootstrap-server.sh '<STRONG_DB_PASSWORD>'
```

This installs swap, Node 22, PM2, Postgres 16 (initialized, `ca_sanjay_gst` created,
password set, TCP auth scram-sha-256 on localhost only), Nginx, certbot, awscli.

## 4. Configure the backend environment

```bash
git clone https://github.com/anirudhlohiya/caSanjayBajaj.git /opt/ca-app/backend
cp /opt/ca-app/backend/.env.example /opt/ca-app/backend/.env
vi /opt/ca-app/backend/.env
```

Production values that MUST differ from dev:

| Key | Production value |
|---|---|
| `NODE_ENV` | `production` (disables Swagger, enables fail-fast config check, reminder cron stays on) |
| `API_BASE_URL` | `https://<DOMAIN>` |
| `DB_PASSWORD` | the bootstrap password |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | fresh 48-byte randoms (`node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` ×2). Boot REFUSES to start if missing or <32 chars |
| `SUPER_ADMIN_EMAIL/PASSWORD/NAME` | REAL firm credentials (not the dev ones) |
| `CORS_ORIGIN` | `https://<DOMAIN>` (defense-in-depth even though same-origin) |
| AWS/SES/VAPID keys | real values |

## 5. First deploy

From the repo root on your Windows machine:

```powershell
powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<EC2-DNS>
```

The script builds both SPAs locally (admin gets `--base-href=/admin/`; client build also
patches `ngsw-worker.js` with push handlers), uploads them, updates the backend from
`origin/main` (fetch/reset → `npm ci` → `migration:run` → build), releases sites into
`/opt/ca-app/frontend/site`, reloads Nginx, restarts PM2, and verifies `/health`.

Verify while still on HTTP:

- `http://<EC2-DNS>/` → client PWA loads
- `http://<EC2-DNS>/admin/` → admin login page
- `http://<EC2-DNS>/api/v1/health` → JSON ok

## 6. DNS + TLS

1. Create an **A record**: `<DOMAIN>` → instance public IP (add `www` if desired).
2. On the server: `sudo certbot --nginx -d <DOMAIN>` — rewrites the Nginx conf to add the
   :443 block + HTTP→HTTPS redirect. Auto-renewal is installed by certbot (`systemctl list-timers | grep certbot`).
3. Re-check all three URLs over **https**.

## 7. Nightly backups (install once)

```bash
sudo install -D -m 700 -o ec2-user -g ec2-user /opt/ca-app/backend/deploy/backup.sh /opt/ca-app/bin/backup.sh
mkdir -p /opt/ca-app/backups
crontab -e        # add exactly this line:
# 30 2 * * * /opt/ca-app/bin/backup.sh >> /opt/ca-app/backups/cron.log 2>&1
```

Also add an S3 lifecycle rule: expire `postgres/*` objects after 30 days.
Test once manually: `/opt/ca-app/bin/backup.sh` then check the S3 prefix.

## 8. Routine operations

| Task | Command (on server) |
|---|---|
| Logs | `pm2 logs ca-api` · `/opt/ca-app/backups/cron.log` |
| Restart API | `pm2 reload ca-api` |
| Frontend-only redeploy | `deploy-from-local.ps1 ... -SkipBackend` |
| DB shell | `sudo -u postgres psql ca_sanjay_gst` |
| Disk space | `df -h` (logs/backups live under `/opt/ca-app`) |

**Rollback:** `cd /opt/ca-app/backend && git reset --hard <previous-tag-or-sha> && npm ci && npm run migration:run && npm run build && pm2 reload ca-api`. Static sites: re-run the ps1 from a machine with the older commit checked out (bundles are content-hashed; last release wins).

## 9. SECURITY CHECKLIST

### 9.1 Hardening applied in code during Phase 5 (this repo)

| Control | Detail |
|---|---|
| HTTP security headers | `helmet()` on every API response |
| Rate limiting | global 120 req/min/IP (`@nestjs/throttler` guard); **login 5/min/IP**; otp/send, otp/verify, signup, reset-password 3/min/IP |
| Swagger off in prod | `NODE_ENV=production` skips Swagger entirely |
| Fail-fast secrets check | refuses boot in prod without JWT secrets (≥32 chars) & DB password |
| Same-origin API calls | prod SPAs use relative `/api/v1` — zero CORS attack surface |
| Dependency audit | `npm audit` clean in backend, admin, client (fixed js-yaml DoS chain via @nestjs/swagger) |

### 9.2 Already true by design (verified)

| Area | State |
|---|---|
| Password storage | argon2 hashing; min length enforced |
| Tokens | 15-min access JWTs + rotating refresh tokens stored **hashed** server-side; logout revokes |
| Authorization | permission checks enforced by NestJS guards server-side (not just hidden UI) |
| Input validation | global `ValidationPipe` whitelist+transform on every route |
| SQL injection | TypeORM parameterized queries only |
| XSS | Angular template sanitization; no innerHTML sinks |
| File handling | private S3 buckets, pre-signed URLs (300-s PUT TTL), bytes never touch the API server |
| Secrets | `.env` gitignored; only `.env.example` committed; PM2 loads env via Node `--env-file` |

### 9.3 Required at deploy time (check off when done)

- [ ] Security group: 22 from your IP only; 80/443 public; **no other ports**
- [ ] Postgres bound to localhost only, scram-sha-256 (done by bootstrap; verify `ss -tlnp | grep 5432`)
- [ ] HTTPS active via Let's Encrypt + auto-renew timer running
- [ ] `CORS_ORIGIN=https://<DOMAIN>` set
- [ ] Real super-admin credentials seeded (NOT `sanjay@gmail.com`/dev values)
- [ ] SES production access granted (sandbox otherwise limits recipients)
- [ ] Backup cron installed AND tested once
- [ ] S3 lifecycle rule on backups bucket (30 days)
- [ ] `pm2 save` executed so ca-api survives reboot; `systemctl is-enabled nginx postgresql pm2-ec2-user`

### 9.4 Residual risks (accepted / documented)

| Risk | Mitigation / rationale |
|---|---|
| JWTs held in localStorage | XSS-mitigated by Angular sanitizer + helmet CSP-lite headers; refresh rotation bounds token theft to 15 min. Native wrapper (Phase 4) can move to biometric-locked storage later |
| Single instance, single AZ | Accepted cost constraint (₹0–100/mo target); nightly off-site DB backups limit blast radius |
| No WAF / DDoS protection | Rate limiter is first line; AWS Shield Standard free tier applies |
| Cron timezone | Reminder job fires 08:00 **server time** — set instance TZ to Asia/Kolkata: `sudo timedatectl set-timezone Asia/Kolkata` |
| No log shipping | PM2 flat logs on disk; adequate at this scale, revisit if issues appear |
