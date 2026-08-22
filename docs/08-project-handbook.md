# Project Handbook — CA Practice Management Platform

> **This is the single self-contained reference for anyone (human or AI) working on this repo.**
> Read it fully before touching code. It covers what we are building, what is already built,
> how everything runs, every credential location, and the current status.
>
> Companion docs (all in `docs/`): `01-prd.md` (requirements), `02-trd.md` (technical),
> `03-app-flow.md` (screens/flows), `04-uiux-design-brief.md` (design), `05-backend-schema.md`
> (schema), `06-implementation-plan.md` (build sequence), `07-aws-reference.md` (AWS + push,
> reusable per client). `PROJECT_CONTEXT.md` is the original requirements context.

---

## 1. What we are building

A SaaS platform for **CA Sanjay Bajaj & Co.** (a chartered accountant firm) to replace its
manual email/WhatsApp process for GST compliance work. Clients upload their GST documents,
the firm reviews them and delivers completed GST reports, and the system sends filing-due-date
reminders.

Three audiences:

| Audience | App | Does |
|---|---|---|
| **Client (GST user)** | **Client PWA** ("Fiscal Integrity") — installable, mobile-first web app + thin Android WebView wrapper later | Login, upload documents per filing period, track status, download reports, get push/email notifications & reminders |
| **The CA + staff** | **Admin web** ("Fiscal Precision") — Angular dashboard | Manage clients, review documents, upload/send reports, trigger reminders, manage staff & permissions, audit log, filing-period settings |
| **Backend** | **NestJS API** (Node 22) | Serves both apps; owns DB, S3 signed URLs, SES email, VAPID web push |

**Phase structure:** 0 = foundations/docs, 1 = backend, 2 = admin web, 3 = client PWA,
4 = Android wrapper, 5 = AWS deploy. Phases 0–3 are code-complete; 4 and 5 not started.

---

## 2. Fixed technology stack (do NOT substitute)

| Layer | Choice |
|---|---|
| Backend | Node.js 22 + **NestJS 11** (TypeScript), TypeORM, PostgreSQL 16 |
| Database | PostgreSQL 16, self-hosted (Phase 5: on the same EC2 as the API; dev: local Docker) |
| Admin web | **Angular 20** (standalone components, lazy routes, signals) + **Tailwind CSS v4** |
| Client | **Angular 20 PWA** (installable, mobile-first) — NOT a native app in Phase 1–3 |
| Android wrapper (Phase 4) | Kotlin WebView shell around the PWA |
| File storage | **Amazon S3**, private buckets, pre-signed URLs only (never proxy bytes through the server) |
| Email | **Amazon SES** (`@aws-sdk/client-sesv2`) |
| Push | **Web Push protocol** via the `web-push` npm lib + self-generated **VAPID keys** — **NO Firebase/FCM** (dropped to keep cost ₹0 and remove a second account) |
| Hosting (Phase 5) | Single EC2 t3.micro/t2.micro, Amazon Linux 2023, Nginx reverse proxy, Let's Encrypt SSL, PM2 |
| Scheduling | `@nestjs/schedule` cron (daily reminder job) |
| Tests | Backend: Jest; Admin/Client: Karma + Jasmine |

### Cost constraint (hard requirement)
Minimize AWS running cost. Free Tier where possible; one EC2; no RDS; no paid third-party
services; SES for email; self-hosted VAPID for push. Realistic monthly cost ≈ ₹0–100 at launch scale.

---

## 3. Repo layout (current, working tree)

```
sanjay project/
├── docs/                    # 01–07 (see above) + this handbook
├── design-references/       # approved UI mockups
├── PROJECT_CONTEXT.md       # original requirements context (superseded on PWA/VAPID decisions)
├── Client_Summary.pdf
├── backend/                 # NestJS API — Phase 1 (code complete, live-tested)
├── admin/                   # Angular admin dashboard — Phase 2 (code complete, live-tested)
├── client/                  # Angular client PWA — Phase 3 (code complete, build+test green)
├── android-wrapper/         # Phase 4 (empty, not started)
├── admin-web/  client-web/  # stale empty folders from planning — do not use (real dirs are admin/, client/)
└── .gitignore               # .env + .env.* gitignored (only .env.example is committed)
```

Git: remote `origin` = https://github.com/anirudhlohiya/caSanjayBajaj.git, branch `main`.
One commit per milestone. Latest pushes: `5850c89` (Phase 2), `3086169` (Phase 3),
`b8ed5c4` (AWS/Postgres wiring + live fixes).

---

## 4. Backend (Phase 1) — `backend/`

### 4.1 Auth model
- Two token surfaces: **client tokens** (identify `users`, JWT `type: 'user'`) and **admin
  tokens** (identify `admins`, JWT `type: 'admin'`).
- `POST /auth/login/user` and `POST /auth/login/admin` return ONLY `{access_token, refresh_token}`.
  Identity is decoded from the JWT payload `{sub, type, email, role?, permissions?}`; profile
  is fetched via `/me` (client) or `/admin/me` (admin).
- Access TTL 15m, refresh TTL 30d. Refresh tokens stored hashed in `refresh_tokens` (rotating).
- Passwords: **argon2** (`argon2` npm). Validation enforces min 8 chars on auth/creation.

### 4.2 Entities (TypeORM, `backend/src/entities/`)
`users`, `admins`, `permissions`, `documents`, `reports`, `reminders` (send log),
`gst_filing_periods`, `audit_logs`, `refresh_tokens`, `device_tokens`, `report_notifications`
(app-inbox for clients; added in Phase 3).

Key enums (`backend/src/common/enums/index.ts`): `UserType gst|itr`, `UserStatus active|inactive`,
`AdminRole super_admin|staff`, `DocumentFileType pdf|image|excel`, `DocumentStatus pending|received|processed`,
`ReportType gstr_1|gstr_3b|reconciliation|other`, `ReminderChannel push|email`, `ReminderStatus queued|sent|failed`,
`DevicePlatform pwa|android`. Permission keys: `view_clients, view_documents, upload_reports,
send_reminders, manage_staff, view_audit_logs, manage_settings`.

### 4.3 Complete API route table (global prefix `api/v1`, Bearer auth, Swagger at `/api/docs`)

| Method | Route | Who | Notes |
|---|---|---|---|
| POST | `/auth/login/user` | public | client login → tokens |
| POST | `/auth/login/admin` | public | admin login → tokens |
| POST | `/auth/refresh` | public | rotate refresh token |
| POST | `/auth/logout` | authed | revoke refresh token |
| GET | `/me` | client | own profile |
| PATCH | `/me` | client | update name/phone/gstin |
| POST | `/me/change-password` | client | current+new, min 8 |
| POST | `/me/device-token` | client | register push subscription `{push_token, platform:'pwa'|'android'}` |
| DELETE | `/me/device-token` | client | remove subscription |
| GET | `/me/documents` | client | own docs, filter `filing_period_id`, `status`, paginated |
| GET | `/me/reports` | client | own reports, filter period/type, paginated |
| GET | `/me/reports/:id/download-url` | client | signed GET URL |
| GET | `/me/notifications` | client | app inbox, `unread_only` filter |
| POST | `/me/notifications/read-all` | client | mark all read |
| POST | `/me/notifications/:id/read` | client | mark one read |
| POST | `/documents/upload-url` | client/admin | **S3 pre-signed PUT** + `document_id` |
| POST | `/documents/:id/confirm` | client/admin | mark `received` (send actual bytes) |
| GET | `/documents/:id/download-url` | client/admin | signed GET URL |
| GET | `/periods/open` | authed | open filing periods |
| GET | `/periods/:id` · PATCH `/periods/:id` | admin (`manage_settings`) | view/close period |
| POST | `/admin/reports` | admin (`upload_reports`) | **S3 pre-signed PUT** + `report_id` |
| POST | `/admin/reports/:id/confirm` | admin (`upload_reports`) | record notification + push + SES email (never attach file) |
| GET | `/admin/reports` · `/admin/users/:userId/reports` | admin | lists |
| GET | `/admin/reports/:id/download-url` | admin | signed GET |
| GET | `/admin/documents` · `/admin/users/:userId/documents` | admin (`view_documents`) | lists |
| PATCH | `/admin/documents/:id/processed` | admin (`view_documents`) | mark processed |
| GET/POST/PATCH/DELETE | `/admin/users` `[:id]` | admin (`view_clients`) | manage client users |
| GET/POST/PATCH/DELETE | `/admin/staff` `[:id]` | super_admin | manage staff |
| GET/PUT | `/admin/staff/:id/permissions` | super_admin | granular permission flags |
| GET | `/admin/me` | admin | own identity |
| GET | `/admin/dashboard/stats` | admin | stats (snake_case: `total_clients`, `open_periods`, `upcoming_due_dates`, etc.) |
| POST | `/admin/reminders/send` | admin (`send_reminders`) | `{user_id?|all_unfiled, filing_period_id, channels:['push'|'email']}` → logged |
| GET | `/admin/reminders/log` | admin (`send_reminders`) | send log, filterable |
| GET | `/admin/audit-logs` | admin (`view_audit_logs`) | admin actions log |
| GET | `/health` | public | liveness |

Pagination: every list returns `{items, total, page, pageSize, totalPages}`. Filter values are
snake_case in the API (`filing_period_id`, `file_size_bytes`, `report_type`, etc.).

### 4.4 Migrations & seed
- Migrations: `InitialSchema1700000000000`, `ReportNotifications1700000000001`
  (run via `npm run migration:run`).
- Seed (`npm run seed`, module `src/database/seed.module.ts`): creates the super admin and
  the current + next 2 filing periods (due 11th of following month). Requires
  `SUPER_ADMIN_EMAIL/PASSWORD` in `.env`. **Fixed bug:** seed module must register
  `TypeOrmModule.forFeature([Admin, GstFilingPeriod])`.

### 4.5 DI gotcha (fixed)
`JwtAuthGuard` injects `JwtService`. Register JwtModule once in `auth.module.ts` as
`JwtModule.register({ global: true })` so it resolves in every feature module. Without
`global: true` the app fails to boot with `UnknownDependenciesException`.

---

## 5. Admin web (Phase 2) — `admin/` ("Fiscal Precision")

- Angular 20 standalone, lazy routes, signals; **Tailwind v4** design tokens in `src/styles.css`.
- **Tailwind gotcha:** Angular's builder only auto-detects **JSON** PostCSS config —
  `admin/postcss.config.json` with `{"plugins": {"@tailwindcss/postcss": {}}}` +
  `@source './app'` in `styles.css`. Do NOT use a `postcss.config.js` (silently ignored).
- **UI polish (done, uncommitted as of 64d94fa):** reusable component classes in `styles.css`
  (`@layer components`): `.btn-primary`, `.btn-outline`, `.btn-icon`, `.input`, `.card`,
  `.label`, `.th`. Every list screen renders **stacked mobile cards** below `md` (tables stay
  for `md+`): dashboard recent activity, clients-list, documents, reports, staff, audit,
  reminders send log, settings (filing periods). Pattern: `md:hidden` card `@for` + `hidden
  md:block` table wrapper.
- API base: `src/environments/environment.ts` = `http://localhost:3000/api/v1`; runtime
  override via `localStorage.FP_API_URL`.
- Tokens: `localStorage` `fp_admin_access` / `fp_admin_refresh`; single-flight refresh interceptor.
- Features (`src/app/features/`): `auth/login`, `shell`, `dashboard`, `clients`, `documents`,
  `reports`, `reminders`, `staff`, `audit`, `settings`. Shared: `StatusChip, Pagination, Modal,
  EmptyState, PageHeader, Spinner, ToastContainer`.
- Routing is permission-gated (`view_clients`, `view_documents`, `upload_reports`,
  `send_reminders`, `manage_staff`, `view_audit_logs`, `manage_settings`); super admin has all.
- Scripts: `npm start` (:4200), `npm test` (Karma/ChromeHeadless), `npm run build` → `dist/admin/browser`.
- Live-test login (dev DB): `sanjay@gmail.com` / `Sanjay@2026`.

---

## 6. Client PWA (Phase 3) — `client/` ("Fiscal Integrity")

- Angular 20 standalone PWA (via `@angular/pwa` service worker), Tailwind v4 (same JSON
  postcss + `@source './app'` pattern). "Fiscal Integrity" theme in `src/styles.css`
  (primary `#001433`, secondary `#305EA4`, secondary-container `#87B1FD`,
  report-ready `#2C5AA0` on `#E8EDF5`).
- **Service worker push:** Angular always emits its stock `ngsw-worker.js` (a custom
  `src/ngsw-worker.js` is ignored by the build). A post-build step `scripts/patch-sw.js`
  (wired into `npm run build`) appends `push` + `notificationclick` handlers (navigates the
  open client on click via a `NOTIFY_NAVIGATE` message handled by `PushService`).
  `ngsw-config.json`: `dataGroups` for API GETs (networkFirst) + `navigationRequestStrategy: "freshness"`.
- API base: `src/environments/environment.ts` = `http://localhost:3000/api/v1`,
  VAPID public key set. Runtime overrides: `localStorage.FP_API_URL`, `localStorage.FP_VAPID_KEY`.
- Tokens: `localStorage` `fp_user_access` / `fp_user_refresh`; single-flight refresh + error toast
  interceptors; `authGuard`/`guestGuard`.
- Features (`src/app/features/`): `auth/login`, `shell` (signal-based online banner, bottom nav),
  `dashboard` (greeting, pending uploads, latest report, open periods, FAB), `upload`
  (multi-file ≤50MB, S3 pre-signed PUT with progress/retry, **IndexedDB offline queue** +
  resume, `upload-queue.service.ts`), `documents` (status/period filters, pagination, detail
  sheet + signed download), `reports` (period filter, signed download), `notifications`
  (inbox, mark-all-read, deep links), `profile` (phone edit, push/email toggles, change
  password, logout). Shared: `StatusChip, ToastContainer, Spinner, EmptyState, PageHeader`.
- Routing: `/login`, `/` (shell → dashboard/documents/reports/profile), `/documents/upload`,
  `/notifications`.
- Scripts: `npm start` (:4201), `npm test`, `npm run build` → `dist/client/browser` (also patches SW).
- Live-test login (dev DB): `anirudhlohiya999@gmail.com` / `Client@2026`.

---

## 7. Android wrapper (Phase 4) — `android-wrapper/`

Not started. Kotlin WebView shell around the deployed PWA. Registers its own push token
(platform `'android'`) if native push is wanted; decision deferred. `.gitignore` already
covers Gradle caches, `local.properties`, builds, keystores.

---

## 8. AWS & push — where credentials live

Full walkthrough in `docs/07-aws-reference.md` (reusable per client). Summary:

| Resource | Value | Where configured |
|---|---|---|
| AWS region | `ap-south-1` (Mumbai) | `backend/.env` `AWS_REGION` |
| IAM user | `ca-backend` (S3+SES+SNS full access) | Access keys in `backend/.env` |
| S3 buckets | `ca-sanjay-gst-docs` (private), `ca-sanjay-backups` (private) | `backend/.env` `S3_DOCS_BUCKET`, `S3_BACKUP_BUCKET` |
| SES verified identity | `anirudhlohiya999@gmail.com` (SUCCESS); domain `lohiyaanirudh.tech` PENDING | `backend/.env` `SES_SOURCE_EMAIL` |
| Web push | Self-generated VAPID keys (public + private) | `backend/.env` `FIREBASE_VAPID_*`; public key also in `client/.../environment.ts` |
| Super admin | `sanjay@gmail.com` / `Sanjay@2026` (dev) | `backend/.env` `SUPER_ADMIN_*` |

**No Firebase** — the `FIREBASE_PROJECT_ID/APP_API_KEY/AUTH_DOMAIN` vars are legacy/unused,
left empty. Generate fresh VAPID keys per client with `cd backend && npx web-push generate-vapid-keys`.

**Secrets rule:** real secret VALUES (AWS keys, JWT secrets, DB password, VAPID private key)
live ONLY in `backend/.env`, which is gitignored. Never commit `.env`, screenshots, or chat
pastes of secrets. `.env.example` documents every variable (safe to commit). The VAPID
**public** key and Firebase-style public config values are safe to commit.

---

## 9. Environment variables

`backend/.env` (gitignored, copy from `.env.example`): `NODE_ENV, PORT, API_BASE_URL,
DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_LOGGING, JWT_ACCESS_SECRET,
JWT_REFRESH_SECRET, JWT_ACCESS_TTL, JWT_REFRESH_TTL, AWS_REGION, AWS_ACCESS_KEY_ID,
AWS_SECRET_ACCESS_KEY, S3_DOCS_BUCKET, S3_BACKUP_BUCKET, SES_SOURCE_EMAIL, SES_SOURCE_NAME,
FIREBASE_VAPID_PUBLIC_KEY, FIREBASE_VAPID_PRIVATE_KEY, FIREBASE_VAPID_SUBJECT,
SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME, REMINDER_LEAD_DAYS,
REMINDER_CRON, CORS_ORIGIN`.

CORS: `main.ts` enables CORS; empty `CORS_ORIGIN` → reflect any origin (dev). Restrict to
the admin/client origins before production.

---

## 10. How to run everything locally

> **Beginner-friendly version:** the full walkthrough — prerequisites, Docker *and* native
> Windows PostgreSQL paths, `.env` explained key by key, AWS wiring, a manual E2E test
> script, and a troubleshooting table — lives in **`09-run-and-test-guide.md`**.
> The short version is below.

```bash
# 1. Database (Postgres 16 in Docker — container "ca-pg", volume "ca-pg-data")
docker run -d --name ca-pg -e POSTGRES_PASSWORD=<DB_PASSWORD> -e POSTGRES_DB=ca_sanjay_gst -p 5432:5432 postgres:16

# 2. Backend (migrations + seed once, then serve)
cd backend
npm install
npm run migration:run
npm run seed                 # creates super admin + 3 open periods (needs .env filled)
npm run start:dev            # http://localhost:3000/api/v1  |  Swagger /api/docs

# 3. Admin (separate terminal)
cd admin
npm install
npm start -- --port 4200     # http://localhost:4200

# 4. Client (separate terminal)
cd client
npm install
npm start -- --port 4201     # http://localhost:4201

# Tests / build
cd backend && npm test && npm run lint && npm run build
cd admin    && npm test && npm run build
cd client   && npm test && npm run build   # build also patches the service worker
```

Note: the API takes ~40s to boot on Windows (many modules); wait for "Nest application
successfully started" before testing.

---

## 11. Verified end-to-end (live smoke test, real AWS)

A scripted E2E run against the running API + real S3/SES passed:
- admin login → created client user → client login
- document: pre-signed PUT **directly to S3** (200) → confirm → `received` → list → download
  (content byte-verified)
- admin: mark processed; **SES reminder email sent** (`sent:1`) — re-run correctly shows
  `sent:0` because the client already filed for that period (dedup works)
- report: admin pre-signed PUT to S3 → confirm → client notification recorded
  ("Your GST report is ready", `deep_link /reports`, `is_read=false`) → client lists report →
  download (byte-verified)

Still **not** yet exercised: an actual browser push delivery (needs a live PWA subscription —
set `FP_VAPID_KEY` / subscribe in Profile), and the automated reminder cron.

---

## 12. Known issues, gotchas, and next steps

- **Latent bugs found & fixed when first booting live:** seed module lacked
  `TypeOrmModule.forFeature` (seed crashed), and `JwtModule` was not global (app wouldn't
  boot). Both fixed and committed in `b8ed5c4`.
- **Tailwind:** Angular only auto-detects `postcss.config.json`/`.postcssrc.json`, not JS
  configs; must use `@source './app'` in `styles.css`. Applies to both `admin/` and `client/`.
- **Service worker:** stock Angular worker always overwrites any custom `ngsw-worker.js`;
  push handlers are appended post-build by `client/scripts/patch-sw.js`.
- **SES sandbox:** only sends to verified recipients; request production access before real
  clients. The domain `lohiyaanirudh.tech` verification is PENDING (add DNS TXT to use it).
- **Admin UI polish (done, working tree):** user reported the admin UI "looks bad" and wanted
  mobile-friendly. Fixed by adding `@layer components` utility classes (`.btn-primary`,
  `.btn-outline`, `.btn-icon`, `.input`, `.card`, `.label`, `.th`) and converting every list
  screen to stacked card layouts on mobile (`md:hidden` cards + `hidden md:block` tables).
  `ng build` clean, `ng test` 1/1 green. Awaiting user's visual sign-off.
- **Open question:** whether to keep the browser PWA as the primary client or invest in the
  Phase 4 Android WebView wrapper for Play Store distribution.
- **Next steps (pending):** Phase 4 Android wrapper; Phase 5 deploy (EC2, Nginx, Let's Encrypt,
  PM2, backup cron); SES production access; restrict CORS; change the dev super-admin password
  before any non-dev exposure.

---

## 13. Non-negotiable rules for contributors

1. Fixed stack — do not swap technologies (see §2).
2. Files never proxy through the API server — S3 signed URLs only.
3. No plaintext passwords; no public S3 URLs; no unencrypted traffic.
4. Every reminder send and every privileged admin action is logged.
5. Never commit secrets (`.env`, keys, VAPID private key).
6. Keep AWS cost minimal (Free Tier, one EC2, no paid services).
7. The client user is cost-sensitive and new to cloud — keep things simple and documented.