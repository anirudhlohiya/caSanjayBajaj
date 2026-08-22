# deploy/ — Phase 5 deployment kit (single AWS EC2)

One EC2 instance (Amazon Linux 2023, t3.micro) runs everything: Nginx serves both SPAs,
proxies `/api/` to the NestJS API under PM2, PostgreSQL 16 runs locally on the instance.

```
Browser ──▶ Nginx :443
              ├── /            → /opt/ca-app/frontend/site        (Client PWA)
              ├── /admin/      → /opt/ca-app/frontend/site/admin  (Admin SPA)
              ├── /api/        → 127.0.0.1:3000  (PM2 "ca-api", node dist/main.js)
              └── nightly cron → backup.sh → S3 ca-sanjay-backups/postgres/
```

## Files

| File | Runs where | Purpose |
|---|---|---|
| `bootstrap-server.sh` | EC2 (once, as root) | swap, Node 22, PM2, Postgres 16 + DB, Nginx, certbot |
| `nginx-ca-platform.conf` | EC2 | reverse proxy config template (replace `DOMAIN`) |
| `ecosystem.config.js` | EC2 | PM2 definition for `ca-api` (loads `.env` via Node 22 `--env-file`) |
| `backup.sh` | EC2 cron (nightly) | `pg_dump` → gzip → S3 (SSE), prunes local copies |
| `deploy-from-local.ps1` | Windows dev machine | builds prod bundles, ships them, updates backend from git |

## Full walkthrough

See **`docs/10-phase5-deploy-runbook.md`** for the step-by-step runbook including DNS,
TLS, security checklist, and rollback.

## Quick start (after bootstrap)

```powershell
powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN>          # full deploy
powershell -File deploy\deploy-from-local.ps1 -Server ec2-user@<DOMAIN> -SkipBackend   # frontends only
```

## Production URL layout

| App | URL |
|---|---|
| Client PWA | `https://DOMAIN/` |
| Admin panel | `https://DOMAIN/admin/` |
| API | `https://DOMAIN/api/v1` (Swagger disabled in production) |
