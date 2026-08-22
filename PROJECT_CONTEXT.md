# Project Context — CA Practice Management Platform (Phase 1: GST Module)

> This file is the single source of truth for any AI coding tool (Claude Code, Cursor,
> Copilot, etc.) working on this project. It reflects the project's CURRENT state after
> Phases 0–5 tooling. Treat everything below as fixed requirements unless explicitly told
> otherwise. Companion docs (read in this order): `docs/08-project-handbook.md` (deep
> context + gotchas), `docs/09-run-and-test-guide.md` (run/test locally),
> `docs/10-phase5-deploy-runbook.md` (deploy + security checklist).

## 1. What this project is

A platform for **CA Sanjay Bajaj & Co.** (chartered accountant firm) to manage document
collection, GST report delivery, and filing reminders for ~150 GST clients (Phase 1),
replacing a manual email/WhatsApp process. ITR users (~750) are Phase 2 scope, not built.

Three components (all three are CODE COMPLETE and smoke-tested against real AWS):

1. **Client PWA** ("Fiscal Integrity") — Angular 20 installable mobile-first web app in
   `client/`. Clients log in (email+password or OTP signup/reset), upload documents per
   filing period directly to S3 via pre-signed URLs, track document status, download GST
   reports, receive in-app notifications + email + browser web-push.
2. **Admin web panel** ("Fiscal Precision") — Angular 20 dashboard in `admin/`, served at
   `/admin/` in production. The CA (super admin) and staff manage clients, review
   documents, upload/send reports, send reminders, manage staff permissions, view audit
   logs and filing periods.
3. **Backend API** — NestJS 11 (TypeScript) monolith in `backend/`, global prefix
   `api/v1`, Swagger at `/api/docs` (**disabled when NODE_ENV=production**). TypeORM +
   PostgreSQL 16. Serves both frontends.

## 2. Hard constraint: cost

The client is budget-sensitive and new to cloud software. Every architecture decision must
minimize AWS running cost (target ≈ ₹0–100/month):
- Single EC2 t3.micro/t2.micro runs EVERYTHING: API (PM2), PostgreSQL 16 (self-hosted,
  localhost-only), Nginx, both static SPAs. No RDS, no ALB, no ECS.
- Free-tier services only: S3 (private buckets, pre-signed URLs), SES email, self-hosted
  VAPID web push (NO Firebase/FCM account), Let's Encrypt SSL.
- No paid third-party services.

## 3. User roles

| Role | Where | Access |
|---|---|---|
| **GST User** | Client PWA | Login/OTP signup, upload documents per filing period, view status, download reports (full history), get reminders |
| **Super Admin** (the CA) | Admin panel | Everything: clients, documents, reports, reminders, staff accounts, granular permissions |
| **Staff Admin** | Admin panel | Limited access granted per-permission by Super Admin (`view_clients, view_documents, upload_reports, send_reminders, manage_staff, view_audit_logs, manage_settings`) |

Permissions are granular flags per staff account, enforced SERVER-SIDE by NestJS guards.

## 4. Technology stack (fixed — do not substitute)

| Layer | Technology |
|---|---|
| Admin web | Angular 20 standalone + Tailwind v4 (`postcss.config.json` — JSON, NOT .js; Angular ignores JS PostCSS configs) |
| Client | Angular 20 PWA (@angular/service-worker) + Tailwind v4; build patches `ngsw-worker.js` via `client/scripts/patch-sw.js` to add push handlers |
| Backend | Node.js 22 + NestJS 11 (TypeScript), TypeORM, class-validator, argon2, @nestjs/schedule cron |
| Database | PostgreSQL 16 self-hosted on same EC2 (dev: Docker container `ca-pg` or local install); migrations ONLY (`synchronize:false`) |
| File storage | Amazon S3 private buckets; pre-signed PUT (300s TTL) / GET URLs; bytes never proxy through API |
| Email | Amazon SES v2 (`SES_SOURCE_EMAIL`; skipped silently if unset) |
| Push | Web Push protocol, `web-push` npm lib, VAPID keys in `.env` (`FIREBASE_VAPID_*` names are legacy — no Firebase); skipped if unset |
| Hosting | Single EC2 (Amazon Linux 2023), Nginx reverse proxy, PM2 (`node --env-file=.env dist/main.js`), Let's Encrypt |
| Tests | Backend Jest (unit + e2e health smoke); Frontends Karma/Jasmine ChromeHeadless |

### Production URL layout (Phase 5)
Single domain, path-routed by Nginx: `/` = client PWA, `/admin/` = admin SPA (built with
`--base-href=/admin/`), `/api/` proxied to 127.0.0.1:3000. Both SPAs use RELATIVE prod API
base (`environment.prod.ts` → `apiBaseUrl:'/api/v1'`, wired via angular.json
fileReplacements) — CORS irrelevant in production. Dev uses absolute
`http://localhost:3000/api/v1`.

## 5. Current phase status

- Phase 0 docs, 1 backend, 2 admin, 3 client PWA — **DONE** (live E2E passed vs real S3/SES)
- Phase 4 Android wrapper (`android-wrapper/`, Kotlin WebView shell) — NOT STARTED;
  decide after live deployment proves the PWA works for users
- Phase 5 deploy — **KIT COMPLETE in `deploy/`**: `bootstrap-server.sh` (one-time EC2
  setup), `nginx-ca-platform.conf`, `ecosystem.config.js` (PM2), `backup.sh` (nightly
  pg_dump→S3 cron), `deploy-from-local.ps1` (builds locally, ships bundles, updates
  backend from git). Actual provisioning = follow `docs/10-phase5-deploy-runbook.md`.
- Remaining pre-launch manual steps: run the runbook on a real EC2, DNS A record,
  `certbot --nginx -d <DOMAIN>`, SES production access, set REAL super-admin credentials,
  backup cron install, timezone `Asia/Kolkata`.

## 6. Functional notes (implemented)

- Auth: argon2 passwords; JWT access 15m + rotating refresh 30d (refresh tokens hashed in
  DB); OTP-based signup/forgot-password for clients (`otp_verifications` table).
  Tokens per surface: admin `fp_admin_access/refresh`, client `fp_user_access/refresh`
  (localStorage).
- Document flow: client requests `POST /documents/upload-url` → PUTs directly to S3 →
  `POST /documents/:id/confirm`. Statuses `pending → received → processed`. Offline queue
  (IndexedDB) in client app.
- Report flow: admin uploads via pre-signed URL → confirm triggers in-app notification +
  FCM-style web push + SES email (link into app, NEVER raw attachment). Full report
  history kept per period/type (gstr_1, gstr_3b, reconciliation, other).
- Reminders: daily cron 08:00 server time (hardcoded; `REMINDER_CRON` env parsed but
  UNUSED) for open periods due within `REMINDER_LEAD_DAYS`; manual sends logged in
  `reminders` table visible in admin panel.
- Seed (`npm run seed`): super admin from env + test client
  `anirudhlohiya999@gmail.com` / `Client@2026` + current+next-2 filing periods (due 11th
  of following month). Dev-only credentials; must be replaced before production.
- Pagination everywhere: `{items,total,page,pageSize,totalPages}`; snake_case filters.

## 7. Security posture (as of Phase 5 hardening)

Implemented in code: helmet headers; rate limiting (@nestjs/throttler: global 120/min/IP,
login 5/min, OTP flows 3/min); Swagger off in prod; fail-fast boot check (prod refuses to
start without JWT secrets ≥32 chars + DB password); ValidationPipe whitelist+transform;
argon2; TypeORM parameterized queries; permission guards; audit_logs for privileged admin
actions; S3 private buckets short-TTL signed URLs. npm audit clean in all three apps.
Infra checklist lives in `docs/10-phase5-deploy-runbook.md` §9 (SG lockdown, TLS/HSTS,
CORS_ORIGIN restriction, localhost-only Postgres scram-sha-256, backup verification).
Accepted residual risks documented there too (localStorage JWTs, single instance, no WAF).

## 8. Repo layout

```
backend/    NestJS API (code complete, hardened)
admin/      Angular admin dashboard ("Fiscal Precision")
client/     Angular client PWA ("Fiscal Integrity")
deploy/     Phase 5 deployment kit (see its README)
docs/       01–10 documentation set (08 handbook, 09 run guide, 10 deploy runbook)
design-references/  approved UI mockups
android-wrapper/    empty placeholder (Phase 4)
admin-web/, client-web/  STALE EMPTY folders from planning — DO NOT USE
```

Git: origin https://github.com/anirudhlohiya/caSanjayBajaj.git, branch `main`.
Recent commits (Phase-5 tooling milestone): `02ef465` OTP signup/password-reset feature;
`7b478f0` API hardening + production build config; `52bc88c` deploy kit. Secrets policy
unchanged — only `.env.example`, never real `.env`; verified before push via
`.gitignore` (`backend/.env` ignored) and a staged-content secret scan.

## 9. Explicit non-goals for Phase 1

No iOS/native app (PWA + optional thin wrapper later); no WhatsApp notifications (later);
no RDS; no multi-region/HA; no ITR logic; no payments/billing.

## 10. Open items

- Live-test browser push delivery end-to-end (needs HTTPS + Profile-page subscription).
- Observe one reminder-cron firing in production-like conditions.
- Client sign-off on reworked mobile-friendly admin UI.
- Phase 4 go/no-go decision (Play Store presence vs PWA-only).

## 11. Non-negotiable rules for contributors

1. Fixed stack — do not substitute technologies (§4).
2. Files never proxy through the API server — S3 signed URLs only.
3. No plaintext passwords; no public S3 URLs; no unencrypted traffic in prod.
4. Every reminder send and privileged admin action is logged.
5. Never commit secrets (`.env`, keys, VAPID private key). Only `.env.example` is committed.
6. Keep AWS cost minimal (Free Tier, one EC2, no paid services).
7. The user is cost-sensitive and new to cloud — keep things simple and documented.
