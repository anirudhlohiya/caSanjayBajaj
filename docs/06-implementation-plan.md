# 06 — Implementation Plan (exact step-by-step build sequence)

**Project:** CA Practice Management Platform — Phase 1 (GST Module)
**Related docs:** `01-prd.md`, `02-trd.md`, `03-app-flow.md`, `05-backend-schema.md`

This is the working build sequence. **Order of delivery (as agreed): Backend → Admin Web → Client PWA → Android wrapper → Deploy.** Each milestone ends with a commit; the repo pushes to `github.com/anirudhlohiya/caSanjayBajaj`.

---

## Phase 0 — Foundations & cloud setup

**Goal:** repo + working cloud account + environments ready.

### 0.1 Repository (DONE)
- [x] `git init`, `main` branch, `.gitignore`, remote `origin` → `caSanjayBajaj`.
- [x] Monorepo folders: `backend/`, `admin-web/`, `client-web/`, `android-wrapper/`, `docs/`, `design-references/`.
- [x] This documentation set written and committed.

### 0.2 AWS setup — ONE-TIME, needs the client/you (from `02-trd.md` §2)
1. **IAM user** `ca-backend` (programmatic) with `AmazonS3FullAccess`, `AmazonSESFullAccess`, `AmazonSNSFullAccess` → save Access Key ID + Secret.
2. **S3 buckets** (private, Block-all-public = ON): `ca-sanjay-gst-docs`, `ca-sanjay-backups`.
3. **SES**: verify an email address now; verify the firm's domain later; request production access before real client email.
4. **Firebase**: create project; register Web app → copy `firebaseConfig`; generate VAPID key (Cloud Messaging settings).
5. **EC2**: launch t3.micro (Amazon Linux 2023), key pair, SG allowing 22/80/443. Record Public IP + `.pem` path.
6. Share with the team: the above values → filled into `.env` (never committed).

### 0.3 Provision EC2 (I execute once keys/IP provided)
- Install Node 22, PostgreSQL 16, Nginx, PM2.
- Create DB `ca_sanjay_gst` + app user; enable extensions; set `pg_hba` for app user.
- Create backup cron: nightly `pg_dump` → `s3://ca-sanjay-backups/`.
- Install Let's Encrypt `certbot` for the domain (or use during Phase 5).

### 0.4 Scaffold projects
- `backend/` NestJS; `admin-web/` Angular; `client-web/` Angular (with PWA schematic).
- `.env.example` per app; README run instructions.

**Acceptance:** repo runs `npm run build` in each app against `.env.example` values; EC2 reachable over SSH.

---

## Phase 1 — Backend API (NestJS)  ← FIRST DELIVERABLE

**Goal:** every backend capability the two frontends need, real AWS from day one.

### 1.1 Foundation
- Nest app skeleton, `ConfigModule`, global `ValidationPipe`, Swagger at `/api/docs`.
- TypeORM + Postgres connection, `synchronize:false`, migrations + seed script (Super Admin, filing periods).
- Global error handling + request logging.

### 1.2 Auth module
- `users` + `admins` login (argon2), JWT access + refresh issuance, `/auth/refresh`, logout (revoke).
- `JwtAuthGuard`, `RolesGuard`, `PermissionsGuard` (permission keys loaded into token).
- Rate limiting on login.

### 1.3 Users & admin management
- Client user CRUD (`users` module) — used by admin and by client self-service (profile).
- Staff CRUD + granular `permissions` toggles (`admin-management` module) — Super Admin only.
- Permission keys per `01-prd.md` §6.

### 1.4 Documents module
- `POST /documents/upload-url` → pre-signed PUT + record; `POST /documents/:id/confirm`; status flow.
- `GET /documents/:id/download-url`; list with pagination + filter (`filing_period`, `status`).
- Only the owning client, Super Admin, or staff with `view_documents` can read.

### 1.5 Reports module
- Admin uploads report (user + period + type) → S3 → record (history retained).
- Post-upload hook → **FCM push + SES email** with app links (never attachments).

### 1.6 Reminders module + scheduler
- `reminders` log model; manual trigger (single/group/channel) by admin with `send_reminders`.
- `@nestjs/schedule` cron: daily scan for open periods within `REMINDER_LEAD_DAYS` → auto-send + log (`triggered_by='system'`).
- Duplicate-guard reads the log before sending.

### 1.7 Notifications & storage adapters
- `notifications.service`: SES email + FCM Web Push (VAPID); `device_tokens` storage.
- `storage.service`: S3 pre-signed PUT/GET via `@aws-sdk/client-s3`.
- Both strictly env-driven; if AWS values absent → explicit startup warning (no silent fallback).

### 1.8 Audit logging
- Interceptor/guard logs privileged admin actions to `audit_logs` (action, actor, target, detail).
- Read endpoint gated by `view_audit_logs`.

### 1.9 Quality gates
- `npm run lint`, unit tests (auth, permissions), e2e (upload→confirm→report→reminder), `npm run build`.
- Swagger browsable.

**Acceptance:** Postman/curl walkthrough of full loop; admin can login, list clients, see uploaded doc, upload report, trigger reminder, view audit; client can login, upload, view report.

---

## Phase 2 — Admin Web (Angular, "Fiscal Precision")  ← SECOND DELIVERABLE

**Goal:** the CA + staff dashboard per `03-app-flow.md` §2.

### 2.1 App shell
- Angular + Tailwind with the admin token set (`04-uiux-design-brief.md` §3).
- Auth guard, permission-based route guards (403 state), sidebar + top bar + global search.

### 2.2 Screens (mockups in `design-references/admin-dashboard/`)
1. **A1 Login**
2. **A2 Overview** — KPI cards + recent activity table
3. **A3 Clients List** — search, filters (period/status), pagination, add-client dialog
4. **A4 Client Detail** — tabs Documents/Reports/Activity; signed-URL preview/download; mark-processed
5. **A5 Send Report** — modal (period, type, file) → triggers notifications
6. **A6/A7 Documents & Reports** — cross-client filterable tables
7. **A8 Reminders** — manual trigger + full log with resend
8. **A9 Staff & Permissions** — staff CRUD + permission toggles (Super Admin)
9. **A10 Audit Logs** — read-only trail
10. **A11 Settings** — filing periods/due dates, reminder lead days

### 2.3 Quality gates
- Component tests for critical flows; build; permission-matrix manual test (Super Admin vs staff with partial rights).

**Acceptance:** a staff account with only `view_clients` + `upload_reports` can perform exactly that — and nothing else; every action appears in audit.

---

## Phase 3 — Client Web PWA (Angular, "Fiscal Integrity")  ← THIRD DELIVERABLE

**Goal:** the installable client app per `03-app-flow.md` §1.

### 3.1 App shell
- Angular + Tailwind, client token set (`04-uiux-design-brief.md` §2).
- PWA: manifest (name/icons/theme), service worker, installability (Add to Home Screen).
- Bottom navigation (Home/Documents/Reports/Profile), top bar, FAB.

### 3.2 Screens (mockups in `design-references/client-portal/`)
1. **C1 Login**
2. **C2 Dashboard** — pending uploads, latest report, recent filing periods
3. **C3 Upload Documents** — period picker, multi-file select (PDF/image/Excel), pre-signed PUT, confirm, progress + retry
4. **C4 Document Status** — status chips, filters, document detail bottom sheet
5. **C5 Filing Reports** — full history, download via signed URL
6. **C6 Notifications** — list, unread dots, deep links
7. **C7 Profile** — details, notification prefs, change password, logout

### 3.3 Push on web
- Service worker push handler; subscribe via `PushManager`; send subscription (FCM Web Push / VAPID) to `device_tokens`.
- Offline shell + queued upload behavior.

### 3.4 Quality gates
- Build; Lighthouse PWA audit (installable, offline, 100% core); manual E2E on a phone-sized viewport.

**Acceptance:** on an Android phone, a client can "Add to Home Screen", login, upload documents straight to S3, receive a push when the CA sends the report, and download the report.

---

## Phase 4 — Android wrapper (thin shell)  ← OPTIONAL DELIVERABLE

**Goal:** distribute the PWA via Play Store as a native app without rebuilding UI.

- Kotlin Android app: single-activity `WebView` loading the deployed PWA URL.
- **FCM native token** registered in the shell and synced to `device_tokens` (Web Push doesn't run inside WebView — this restores push in the installed app).
- Deep links: push taps open the right in-app route.
- Signed APK/AAB for Play Store release.

**Acceptance:** installed APK opens the PWA, receives FCM pushes, deep-links to the Reports screen.

---

## Phase 5 — Deployment (EC2, production)

**Goal:** live, HTTPS, backed up.

1. Nginx server blocks: admin subdomain → static `admin-web` build; client subdomain → static `client-web` build (PWA); `api` subdomain → proxy to NestJS (PM2).
2. Let's Encrypt SSL via certbot (auto-renew cron).
3. Env values finalized in `.env`; `NODE_ENV=production`; PM2 startup on boot.
4. Migration + seed on first boot; backup cron verified (test restore).
5. Smoke test the full loop in production (Journeys 1–5 from `03-app-flow.md`).

**Acceptance:** HTTPS site + API live; upload → review → report → reminder verified end-to-end; a `pg_dump` restored successfully from the backup bucket.

---

## Phase 6 — Wrap-up & handoff

- Final README (how to run/dev/deploy), deployment runbook, docs review.
- Reset demo data → seed real client list (150 GST clients).
- Handoff checklist + client-facing summary (what was delivered, how to use, cost estimate).

**Definition of done:** Phase 1 live on HTTPS with real clients uploading, real reports delivering, auto reminders firing, staff scoped by permissions, audit trail on, nightly backups verified, and full documentation committed to the repo.

---

## Milestone & commit cadence

| # | Milestone | Commit when |
|---|---|---|
| 0 | Foundations + AWS | after scaffold builds |
| 1 | Backend complete | after quality gates pass |
| 2 | Admin web complete | after permission matrix passes |
| 3 | Client PWA complete | after PWA audit passes |
| 4 | Android wrapper | after APK install test |
| 5 | Deploy live | after smoke test |

Each milestone = one (or a small set of) well-described commit(s); push to `origin/main` after each.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| SES sandbox blocks client email | Verify domain early; request production access in Phase 5 |
| Web Push unreliable on some Android browsers | Standard Push API is supported on Chrome/Edge Android; install path recommended |
| WebView lacks Web Push | Phase 4 native FCM token keeps push working in the installed app |
| EC2 single point of failure | Accepted for Phase 1; nightly off-instance backups; RDS migration noted for later |
| VAPID/FCM config drift | Document all credentials in `.env` + a secrets vault; `.env.example` as reference |