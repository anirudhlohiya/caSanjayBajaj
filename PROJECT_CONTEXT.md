# Project Context — CA Practice Management Platform (Phase 1: GST Module)

> This file is the single source of truth for any AI coding tool (Claude Code, Cursor,
> Copilot, etc.) working on this project. It reflects the project's CURRENT state after
> Phases 0–5 tooling + branding + Android wrapper build-out. Treat everything below as
> fixed requirements unless explicitly told otherwise. Companion docs (read in this
> order): `docs/08-project-handbook.md` (deep context + gotchas),
> `docs/09-run-and-test-guide.md` (run/test locally), `docs/10-phase5-deploy-runbook.md`
> (deploy + security checklist).

## 1. What this project is

A platform for **SN Bajaj And Co** (chartered accountant firm — renamed Aug 2026 from
"CA Sanjay Bajaj & Co."; brand applied across all three apps, emails and the Android
launcher) to manage document collection, GST report delivery, and filing reminders for
~150 GST clients (Phase 1), replacing a manual email/WhatsApp process. ITR users (~750)
are Phase 2 scope, not built.

Three components:

1. **Client PWA** ("SN Bajaj And Co – GST Client Portal") — Angular 20 installable
   mobile-first web app in `client/`. Clients log in (email+password or OTP
   signup/reset), upload documents per filing period directly to S3 via pre-signed URLs,
   track document status, download GST reports, receive in-app notifications + email +
   browser web-push.
2. **Admin web panel** ("SN Bajaj And Co – Admin") — Angular 20 dashboard in `admin/`,
   served at `/admin/` in production. The CA (super admin) and staff manage clients,
   review documents, upload/send reports, send reminders, manage staff permissions, view
   audit logs and filing periods.
3. **Backend API** — NestJS 11 (TypeScript) monolith in `backend/`, global prefix
   `api/v1`, Swagger at `/api/docs` (**disabled when NODE_ENV=production**). TypeORM +
   PostgreSQL 16. Serves both frontends.

4. **Android app** (`android-wrapper/`, package `com.snbajaj.portal`) — Kotlin WebView
   shell around the deployed client PWA with a **server-driven forced-update gate**
   (`GET /api/v1/app/version` → `{min_version, latest_version, store_url}`, driven by
   env `APP_ANDROID_MIN_VERSION` / `APP_ANDROID_LATEST_VERSION` / `PLAY_STORE_URL`).
   App opens normally even when outdated; document upload/download is BLOCKED with a
   non-dismissable Play Store dialog when `VERSION_NAME < min_version`. Debug APK v1.0.0
   builds green via Gradle 8.14.2 / AGP 8.7.3 / compileSdk 36 / targetSdk 35; launcher
   icons generated from root `logo.jfif`.

## 2. Hard constraint: cost

The client is budget-sensitive and new to cloud software. Every architecture decision must
minimize AWS running cost (target ≈ ₹0–100/month):
- Single EC2 t3.micro/t2.micro runs EVERYTHING: API (PM2), PostgreSQL 16 (self-hosted,
  localhost-only), Nginx, both static SPAs. No RDS, no ALB, no ECS.
- Free-tier services only: S3 (private buckets, pre-signed URLs), SES email, self-hosted
  VAPID web push (NO Firebase/FCM account), Let's Encrypt SSL.
- No paid third-party services. Scale ceiling ~1000 users total — fine on one micro box.

## 3. Deployment priorities (user-stated order)

1. **Android app first** (client-facing) — wrapper code complete; needs live URL to load.
2. **Admin panel second** — must be reachable from any device after deploy.
3. **Client PWA last** (it's what the Android app wraps).
Domain `lohiyaanirudh.tech` is OWNED by the user; Option A agreed: agent provisions AWS
via AWS CLI installed locally (`C:\Users\Admin\AppData\Local\Programs\Amazon\AWSCLIV2\aws.exe`,
added to user PATH). User runs `aws configure` THEMSELVES (never paste secrets in chat).

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

- Phases 0–3 — **DONE**. Phase 4 Android wrapper — **DONE** (code + debug APK).
- Branding — **DONE**: "SN Bajaj And Co" everywhere; logo-derived icons (commit `0eb0b78`).
- Admin bug-fix pass — **DONE** (`f2cdb1b`): aborted S3 report uploads fixed; bulk
  reminders validator fixed; staff/pagination/AddClient polish.
- **DEPLOYED & LIVE (Aug 23 2026)**: https://lohiyaanirudh.tech on EC2 t3.micro
  `i-09f7e0f0d3fc6414b` (IP 65.0.45.190, ap-south-1, AMI al2023 ami-06a83a7a581c729a9).
  - SSH: `ssh ca-ec2` (alias in `%USERPROFILE%\.ssh\config` → key `F:\Anirudh\ca-platform-key.pem`).
    Server layout: `/opt/ca-app/repo` = git clone; `/opt/ca-app/backend` = symlink →
    `repo/backend` (the NestJS app + `.env`, chmod 600); `/opt/ca-app/frontend/site` =
    client PWA with `admin/` subdir; PM2 app `ca-api` (boot-persisted via pm2 startup);
    Postgres 16 localhost-only (password in server `.env`); certbot TLS auto-renew.
  - Nginx: security headers repeated in EVERY location (nginx add_header inheritance!),
    HSTS, http2; template updated in deploy kit (`8b74c1a`). rsync-release bug fixed:
    extract OUTSIDE web root or --delete eats the source dir.
  - Prod super admin: sanjay@gmail.com / password given to user in chat (changeable).
  - Backups: nightly 02:30 cron → s3://ca-sanjay-backups/postgres/ (tested OK).
  - Full prod API E2E verified over HTTPS: auth+guards+429 throttle, users CRUD,
    periods, documents, reports presign→S3 PUT→confirm→download round-trip, reminders
    send+log, staff permissions grant/revoke, audit logs, Swagger off, redirects.
- **KNOWN OPEN ITEM — SES SANDBOX**: AWS SES still in sandbox → emails to unverified
  recipients are rejected ("Email address is not verified"). `anirudhlohiya999@gmail.com`
  verification initiated (user must click AWS email); REAL fix = user requests SES
  production access in AWS console. Push reminders show failed until a device subscribes.

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
backend/    NestJS API (code complete, hardened, + app-version endpoint)
admin/      Angular admin dashboard ("SN Bajaj And Co - Admin")
client/     Angular client PWA ("SN Bajaj And Co – GST Client Portal")
deploy/     Phase 5 deployment kit (see its README)
docs/       01–10 documentation set (08 handbook, 09 run guide, 10 deploy runbook)
design-references/  approved UI mockups
android-wrapper/    Android WebView app (com.snbajaj.portal) + store assets + debug APK
logo.jfif           source brand logo (1280x960) — regenerate icons from this
admin-web/, client-web/  STALE EMPTY folders from planning — DO NOT USE
```

Git: origin https://github.com/anirudhlohiya/caSanjayBajaj.git, branch `main`.
Recent commits: `02ef465` OTP signup/password-reset; `7b478f0` API hardening + prod build
config; `52bc88c` deploy kit; `300e153` runbooks; `0eb0b78` SN Bajaj And Co branding +
logo assets; `f2cdb1b` admin bug fixes (uploads/reminders/staff/pagination);
`9a89c5e` Android wrapper with forced-update gate. Secrets policy unchanged — only
`.env.example`, never real `.env`; verified before push via `.gitignore`
(`backend/.env` ignored) and a staged-content secret scan.

## 9. Explicit non-goals for Phase 1

No iOS/native app (PWA + optional thin wrapper later); no WhatsApp notifications (later);
no RDS; no multi-region/HA; no ITR logic; no payments/billing.

## 10. Open items

- **SES production access** (user action in AWS console) — until granted, reminder/OTP
  emails only deliver to verified identities. `anirudhlohiya999@gmail.com` verification
  email pending user click.
- Browser-push live delivery test once a real device subscribes (Profile page).
- Android: sideload debug APK to verify shell + forced-update gate; later Play release
  ($25 dev account) with signed AAB; then raise `APP_ANDROID_MIN_VERSION` on each release.
- Consider revoking `AmazonEC2FullAccess` from `ca-backend` IAM user now that infra is
  provisioned (S3+SES suffice for runtime).

## 11. Non-negotiable rules for contributors

1. Fixed stack — do not substitute technologies (§4).
2. Files never proxy through the API server — S3 signed URLs only.
3. No plaintext passwords; no public S3 URLs; no unencrypted traffic in prod.
4. Every reminder send and privileged admin action is logged.
5. Never commit secrets (`.env`, keys, VAPID private key). Only `.env.example` is committed.
6. Keep AWS cost minimal (Free Tier, one EC2, no paid services).
7. The user is cost-sensitive and new to cloud — keep things simple and documented.
