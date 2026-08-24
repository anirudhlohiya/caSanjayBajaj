# Run & Test Guide — CA Practice Management Platform

> **Audience:** anyone (human or AI) who wants to get the platform running on a machine
> for the first time, exercise every feature manually, and run the automated tests.
> Zero prior knowledge of this repo assumed.
>
> For deeper context read `08-project-handbook.md` (what exists and why) and
> `07-aws-reference.md` (full AWS account setup walkthrough).

---

## Contents

1. [What you are running](#1-what-you-are-running)
2. [Prerequisites](#2-prerequisites)
3. [Step 1 — Database](#3-step-1--database)
4. [Step 2 — Backend API](#4-step-2--backend-api-backend)
5. [Step 3 — Admin web app](#5-step-3--admin-web-app-admin)
6. [Step 4 — Client PWA](#6-step-4--client-pwa-client)
7. [Step 5 — AWS wiring (full functionality)](#7-step-5--aws-wiring-full-functionality)
8. [Manual end-to-end test script](#8-manual-end-to-end-test-script)
9. [Automated tests & production builds](#9-automated-tests--production-builds)
10. [Troubleshooting](#10-troubleshooting)
11. [Quick reference card](#11-quick-reference-card)

---

## 1. What you are running

Three apps talk to each other:

```
┌────────────────┐      ┌─────────────────────┐      ┌──────────────────┐
│  Admin web     │─────▶│                     │─────▶│ PostgreSQL 16    │
│  Angular       │      │   Backend API       │      │ (local Docker or │
│  :4200         │◀─────│   NestJS            │◀─────│  native install) │
└────────────────┘      │   :3000             │      └──────────────────┘
                        │                     │
┌────────────────┐      │  /api/v1 prefix     │─────▶ Amazon S3   (files, signed URLs)
│  Client PWA    │─────▶│  Swagger /api/docs  │─────▶ Amazon SES   (email)
│  Angular       │◀─────│                     │─────▶ Web Push     (VAPID, no Firebase)
│  :4201         │      └─────────────────────┘
└────────────────┘
```

| App | Folder | Port | URL |
|---|---|---|---|
| Backend API | `backend/` | 3000 | http://localhost:3000/api/v1 · Swagger: http://localhost:3000/api/docs · Health: http://localhost:3000/health |
| Admin web ("Fiscal Precision") | `admin/` | 4200 | http://localhost:4200 |
| Client PWA ("Fiscal Integrity") | `client/` | 4201 | http://localhost:4201 |

> **Do not** try to run `admin-web/`, `client-web/`, or `android-wrapper/` — these folders
> are empty planning leftovers (the first two) or not started yet (the wrapper).

Everything runs fine **without any AWS account**, except file uploads/downloads and real
email/push delivery (see §7 for exactly what degrades).

---

## 2. Prerequisites

Install and verify each item before continuing.

### Node.js 22 + npm (required)

```powershell
node -v    # expect v22.x (v20+ will work, 22 is what the repo targets)
npm -v
```

If missing or older: install the LTS from https://nodejs.org (or use nvm-windows).

### Git (required)

```powershell
git --version
git clone https://github.com/anirudhlohiya/caSanjayBajaj.git   # if you don't have it yet
```

### PostgreSQL 16 (required — choose ONE of the two options in §3)

- **Option A — Docker Desktop**: easiest, isolated, matches how the team runs it.
  Verify: `docker --version` and Docker Desktop is running (whale icon in tray).
- **Option B — native Windows install**: no Docker needed; see §3 Option B.

### Google Chrome (needed only for frontend unit tests)

Karma tests in `admin/` and `client/` run in ChromeHeadless, which uses your installed
Chrome. Skip if you won't run frontend tests.

---

## 3. Step 1 — Database

Pick **one** option. Both create an empty database named `ca_sanjay_gst` on port 5432.
The backend migrations create all tables later (§4).

Throughout this guide the example DB password is **`ChangeMe_Local_1`** — replace it with
your own value, but keep it identical in the database AND in `backend/.env` (`DB_PASSWORD`).

### Option A — Docker (recommended)

One command creates a container named `ca-pg` with a persistent volume:

```powershell
docker run -d --name ca-pg `
  -e POSTGRES_PASSWORD=ChangeMe_Local_1 `
  -e POSTGRES_DB=ca_sanjay_gst `
  -p 5432:5432 `
  postgres:16
```

Verify it is healthy:

```powershell
docker ps                       # ca-pg listed, status "Up ..."
docker logs ca-pg               # ends with "database system is ready to accept connections"
```

Useful day-to-day commands:

```powershell
docker stop ca-pg     # shut down (data persists in volume ca-pg-data)
docker start ca-pg    # start again (after reboot you MUST do this)
docker rm -f ca-pg    # delete container entirely (data volume survives unless you also: docker volume rm ca-pg-data)
```

### Option B — Native Windows install (no Docker)

1. Download the PostgreSQL 16 installer: https://www.postgresql.org/download/windows/
   (EDB installer).
2. During installation:
   - Set the **postgres superuser password** — e.g. `ChangeMe_Local_1`. Remember it;
     this goes into `backend/.env` as `DB_PASSWORD`.
   - Keep the default port **5432**.
   - Leave all component checkboxes (pgAdmin, stack builder) enabled.
3. Create the empty database. Open PowerShell:

   ```powershell
   & "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE ca_sanjay_gst;"
   ```

   (enter the superuser password when prompted). Alternatively use pgAdmin:
   right-click *Databases → Create → Database…* → name `ca_sanjay_gst`.

`.env` values for this option: `DB_HOST=localhost`, `DB_PORT=5432`, `DB_NAME=ca_sanjay_gst`,
`DB_USER=postgres`, `DB_PASSWORD=<the password you chose>`.

---

## 4. Step 2 — Backend API (`backend/`)

### 4.1 Configure `.env`

The backend reads all configuration from `backend/.env` (gitignored). Copy the template:

```powershell
cd backend
copy .env.example .env        # PowerShell: Copy-Item .env.example .env
```

Open `.env` in an editor. Minimum required edits for local dev:

| Key | Set to | Notes |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `3000` | |
| `DB_HOST` | `localhost` | |
| `DB_PORT` | `5432` | |
| `DB_NAME` | `ca_sanjay_gst` | created in §3 |
| `DB_USER` | `postgres` | Docker default / Windows installer default |
| `DB_PASSWORD` | your DB password | must match §3 |
| `JWT_ACCESS_SECRET` | long random string | see below |
| `JWT_REFRESH_SECRET` | another long random string | must differ from access secret |
| `SUPER_ADMIN_EMAIL` | e.g. `sanjay@gmail.com` | consumed by `npm run seed` |
| `SUPER_ADMIN_PASSWORD` | e.g. `Sanjay@2026` | min 8 chars |
| `SUPER_ADMIN_NAME` | e.g. `CA Sanjay Bajaj` | |

Generate the two JWT secrets (any terminal, Node required):

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

Run it twice, paste one output into `JWT_ACCESS_SECRET` and the other into
`JWT_REFRESH_SECRET`.

Leave the AWS / SES / VAPID keys **empty for now** — fill them in §7 when you want
uploads, email, and push. Everything else can stay at defaults:

- `REMINDER_LEAD_DAYS` (default 5) — days before a GST due date that auto-reminders fire.
- `CORS_ORIGIN` — leave empty in dev (allows all origins); restrict in production.
- `FIREBASE_PROJECT_ID` / `FIREBASE_APP_API_KEY` / `FIREBASE_AUTH_DOMAIN` — legacy, unused,
  leave empty (push uses self-hosted VAPID, not Firebase).
- `SES_SOURCE_EMAIL` — empty = emails are silently skipped (a warning appears in logs).
- `FIREBASE_VAPID_*` — empty = push notifications silently skipped.

### 4.2 Install, migrate, seed, start

Run inside `backend/`:

```powershell
npm install                # dependencies (~1–2 min)
npm run migration:run      # creates ALL tables (TypeORM migrations)
npm run seed               # super admin + test client + 3 filing periods
npm run start:dev          # starts API with watch mode
```

What the seeder creates (idempotent — safe to re-run):

1. **Super admin** — from your `SUPER_ADMIN_*` env values.
2. **One test client user** — `client.test@snbajaj.com` / `Client@2026`
   (hardcoded dev-only credential in `src/database/seed.ts`).
3. **GST filing periods** — current month + next two months, open, due date = 11th of the
   following month.

Expected startup output (wait for the last line):

```
Nest application successfully started
```

> On Windows the API takes **~40 seconds** to boot. This is normal (many modules).

### 4.3 Verify the backend

| Check | How | Expected |
|---|---|---|
| Process alive | open http://localhost:3000/health | JSON status response |
| Docs reachable | open http://localhost:3000/api/docs | Swagger UI listing all endpoints |
| Auth works | in Swagger, `POST /api/v1/auth/login/admin` with body `{"email":"<SUPER_ADMIN_EMAIL>","password":"<SUPER_ADMIN_PASSWORD>"}` | `200` with `access_token` + `refresh_token` |

Tip: in Swagger click **Authorize** and paste `Bearer <access_token>` to call protected
endpoints directly from the docs page.

Leave this terminal running. Each remaining app needs its **own** terminal.

---

## 5. Step 3 — Admin web app (`admin/`)

New terminal:

```powershell
cd admin
npm install
npm start -- --port 4200
```

Verify: open http://localhost:4200 → redirected to `/login`.

Log in with the seeded super admin (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD`, e.g.
`sanjay@gmail.com` / `Sanjay@2026`). You should land on the Dashboard with stats
(total clients, open periods, upcoming due dates).

Feature checklist while you're here:

- **Clients** — list/create client users
- **Documents** — review uploaded documents, mark processed, download
- **Reports** — upload GST reports per client + period (needs S3, §7)
- **Reminders** — send filing reminders (push/email), view the send log
- **Staff** — create staff accounts + granular permissions (super admin only)
- **Audit** — audit trail of admin actions
- **Settings** — manage filing periods

If the backend runs on a different host/port, point the app elsewhere **without a
rebuild**: in the browser console run
`localStorage.setItem('FP_API_URL', 'http://localhost:3000/api/v1')` and reload.

---

## 6. Step 4 — Client PWA (`client/')

Second new terminal (keep backend + admin running):

```powershell
cd client
npm install
npm start -- --port 4201
```

> The explicit port matters — Angular defaults to 4200, which would clash with the admin app.

Verify: open http://localhost:4200 → no wait — open **http://localhost:4201** → `/login`.

Log in with the seeded test client: `client.test@snbajaj.com` / `Client@2026`.
You should see the Dashboard: greeting, pending-upload count, latest report slot, and the
three open filing periods.

Screens to know:

- **Upload** (blue FAB) — multi-file upload per period (≤50 MB/file, PDF/image/Excel),
  progress + retry, offline queue (IndexedDB) when the network drops
- **Documents** — status filter (`pending → received → processed`), detail sheet, download
- **Reports** — download delivered reports by period/type
- **Notifications** — in-app inbox; push subscription toggle in **Profile**
- **Profile** — phone number, push/email toggles, change password

Same runtime override as admin: `localStorage.setItem('FP_API_URL', ...)`;
push key override: `localStorage.setItem('FP_VAPID_KEY', ...)`.

---

## 7. Step 5 — AWS wiring (full functionality)

Nothing below is needed just to browse the UIs. It IS needed for: **document/report
upload & download (S3), real emails (SES), and browser push (VAPID)**.

Behavior when keys are absent:

| Capability | Without config |
|---|---|
| S3 pre-signed URLs | ❌ fails at request time (`getOrThrow` on bucket config) — uploads error out |
| SES email | ⚠️ skipped silently (warning logged, no crash) |
| Web push | ⚠️ skipped silently |

Full account walkthrough (IAM policy JSON, bucket policies, DNS records):
`docs/07-aws-reference.md`. Summary of what to configure:

### 7.1 IAM user + access keys (S3 + SES)

1. AWS Console → IAM → Users → Create user `ca-backend` (programmatic access).
2. Attach permissions for S3 and SES (see `docs/07-aws-reference.md` for a least-privilege
   policy).
3. Create an **access key**; put the id/secret into `.env`:

   ```
   AWS_REGION=ap-south-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   ```

### 7.2 S3 buckets

Create two **private** buckets (block all public access ON):

- `ca-sanjay-gst-docs` — client documents + reports
- `ca-sanjay-backups` — nightly `pg_dump` target (used in Phase 5 deploy)

Put the names into `.env`: `S3_DOCS_BUCKET`, `S3_BACKUP_BUCKET`.
Restart the API afterwards — restart the backend whenever `.env` changes.

### 7.3 SES (email)

1. SES v2 console → Verified identities → Create identity → **Email address** → confirm
   the verification mail.
2. Put it in `.env`: `SES_SOURCE_EMAIL=<verified address>` (+ optional display name in
   `SES_SOURCE_NAME`).
3. **Sandbox limitation:** until you request *production access*, SES only delivers to
   other verified addresses. For real client emails, submit the production-access request
   (free, usually approved in ~24 h).
4. Optional: verify the domain `lohiyaanirudh.tech` (add the DKIM TXT/CNAME records shown
   in the console) so mail comes from `@lohiyaanirudh.tech`.

### 7.4 Web push (VAPID — no Firebase)

Generate a keypair once:

```powershell
cd backend
npx web-push generate-vapid-keys
```

Fill `.env`:

```
FIREBASE_VAPID_PUBLIC_KEY=<public key output>
FIREBASE_VAPID_PRIVATE_KEY=<private key output>
FIREBASE_VAPID_SUBJECT=mailto:you@example.com
```

Also paste the **public** key into `client/src/environments/environment.ts`
(`vapidPublicKey`) — or set it at runtime via `localStorage.FP_VAPID_KEY` in the client app.

Then subscribe a browser: restart the backend → open the client PWA → Profile → enable
**Push notifications** → accept the browser permission prompt. The subscription is stored
server-side; pushes now deliver even when the tab is closed.

---

## 8. Manual end-to-end test script

With backend + admin + client running, walk the core business loop. Steps marked
**[AWS]** fail without §7 configured; the rest always work.

| # | Actor | Action | Expected result |
|---|---|---|---|
| 0 | You | Open `/health`, Swagger, :4200, :4201 | All respond |
| 1 | Admin | Login → Dashboard | Stats render (non-zero periods) |
| 2 | Admin | Clients → create a fresh client user (or reuse seeded one) | Appears in list |
| 3 | Client | Logout/login as that client → FAB → pick period → attach a small PDF → upload | Progress completes; Documents shows the file `pending` **[AWS]** |
| 4 | Admin | Documents → find it → download | Signed-URL download works, bytes match **[AWS]**; click **Mark processed** | Status chip flips to `processed`; audit entry recorded |
| 5 | Admin | Reminders → send to this client for the period (email channel) | Entry appended in the send log with status; email arrives if SES configured & recipient verified; **re-sending for a filed period shows `sent: 0`** (dedup) |
| 6 | Admin | Reports → upload a sample PDF for the client + period (type GSTR-1) → confirm | **[AWS]** upload succeeds |
| 7 | Client | Notifications | Inbox shows "Your GST report is ready" (unread); Reports lists GSTR-1; download opens the PDF **[AWS]** |
| 8 | Client | Profile → change password → logout → login with new password | Works |
| 9 | Any | Kill the API mid-session and retry a request in either app | Friendly error/toast, no white-screen; recovers when API returns |

Cron check (optional): the auto-reminder job runs daily at 08:00 (hardcoded; `REMINDER_CRON`
is currently parsed but unused) for open periods due within `REMINDER_LEAD_DAYS`. To watch
it fire without waiting, temporarily edit the cron expression in
`backend/src/reminders/reminders.service.ts` (`EVERY_DAY_AT_8AM`) to `* * * * * *`
(every second), restart, and observe the reminders log — revert afterwards.

---

## 9. Automated tests & production builds

### Backend (`cd backend`)

```powershell
npm test           # Jest unit tests (auth service, roles guard) — no DB/AWS needed
npm run test:e2e   # boots a TestingModule, smoke-tests GET /health — no DB/AWS needed
npm run lint       # ESLint (auto-fixes)
npm run build      # compiles to dist/
npm run start:prod # serve the compiled build (after build; still needs .env + DB)
```

Note: the reminder cron disables itself when `NODE_ENV=test`, so tests never spam clients.

### Admin (`cd admin`)

```powershell
npm test           # Karma + Jasmine in ChromeHeadless (Chrome must be installed)
npm run build      # production bundle → dist/admin/browser
```

### Client (`cd client`)

```powershell
npm test           # Karma + Jasmine in ChromeHeadless
npm run build      # production bundle → dist/client/browser
                   # ALSO patches dist/client/browser/ngsw-worker.js with push handlers
                   # (scripts/patch-sw.js). Always ship THIS folder, never skip the patch.
```

To preview a built PWA properly you need an HTTP server (service workers don't run from
`file://`):

```powershell
npx http-server dist/client/browser -p 8080
```

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| API seems dead for ~40 s after `start:dev` | Normal on Windows — wait for `Nest application successfully started` |
| `ECONNREFUSED 127.0.0.1:5432` (or TypeORM connect errors) | DB not running: `docker start ca-pg`, or start the Windows Postgres service (`services.msc` → postgresql-x64-16) |
| `password authentication failed for user "postgres"` | `DB_PASSWORD` in `.env` doesn't match §3. Docker: recreate the container; native: reset via pgAdmin |
| `migration:run` says relation already exists / seed crashes | Run migrations BEFORE seed, on a clean DB. Nuke & redo: `docker rm -f ca-pg && docker volume rm ca-pg-data` then repeat §3A + §4.2 |
| Seed fails asking for super-admin env | `SUPER_ADMIN_EMAIL/PASSWORD/NAME` missing in `.env` |
| Changed `.env` but nothing changed | Restart the API — env vars load at boot |
| Port already in use (3000/4200/4201) | Change `PORT` in `backend/.env`, or `npm start -- --port <other>` for the frontends; then point apps via `FP_API_URL` (§5/§6) |
| Admin/client shows network errors after you moved the API | Set `localStorage.FP_API_URL = 'http://<host>:<port>/api/v1'` in that app and reload |
| Frontend styles look unstyled/broken | Don't convert `postcss.config.json` to `.js` — Angular only auto-detects the JSON config (Tailwind v4 gotcha) |
| Client PWA serves stale UI after a rebuild | Old service worker cached: DevTools → Application → Service Workers → Unregister, then hard-refresh (Ctrl+F5) |
| Push toggle does nothing over Wi-Fi/LAN IP | Web push needs a **secure context**: `http://localhost` is fine, `http://192.168.x.x` is not. Use localhost, or serve over HTTPS |
| Email never arrives | SES sandbox mode (§7.3): recipient must be a verified identity until production access is granted; also check `SES_SOURCE_EMAIL` is set and the API log for warnings |
| Uploads fail instantly with S3 errors | Missing/wrong `AWS_*` or `S3_DOCS_BUCKET` in `.env` (§7.1–7.2); restart API after editing |
| Karma tests hang or can't find Chrome | Install Google Chrome; close stray headless Chrome processes |
| `npm run typeorm ...` CLI weirdness on Windows | Use the npm wrappers (`npm run migration:*`) exactly as documented — they wire ts-node paths for you |
| Accidentally ran something in `admin-web/` or `client-web/` | Those folders are intentionally empty; the real apps are `admin/` and `client/` |

---

## 11. Quick reference card

### Ports & URLs

```
API       http://localhost:3000/api/v1     Swagger http://localhost:3000/api/docs     Health /health
Admin     http://localhost:4200
Client    http://localhost:4201
Postgres  localhost:5432  db=ca_sanjay_gst  user=postgres
```

### Dev credentials (seeded — NEVER use outside local/dev)

| Role | Email | Password | Source |
|---|---|---|---|
| Super admin | value of `SUPER_ADMIN_EMAIL` (e.g. `sanjay@gmail.com`) | value of `SUPER_ADMIN_PASSWORD` (e.g. `Sanjay@2026`) | `.env` via seed |
| Test client | `client.test@snbajaj.com` | `Client@2026` | hardcoded in `src/database/seed.ts` |

### Command cheat-sheet (fresh machine → all three running)

```powershell
# 1) DB (once)
docker run -d --name ca-pg -e POSTGRES_PASSWORD=ChangeMe_Local_1 -e POSTGRES_DB=ca_sanjay_gst -p 5432:5432 postgres:16

# 2) Backend (terminal 1)
cd backend ; copy .env.example .env   # then EDIT .env (see §4.1)
npm install ; npm run migration:run ; npm run seed ; npm run start:dev

# 3) Admin (terminal 2)
cd admin ; npm install ; npm start -- --port 4200

# 4) Client (terminal 3)
cd client ; npm install ; npm start -- --port 4201
```

### Where state lives in the browsers

| Key | App | Meaning |
|---|---|---|
| `fp_admin_access` / `fp_admin_refresh` | admin | JWT pair (15 m / 30 d) |
| `fp_user_access` / `fp_user_refresh` | client | JWT pair |
| `FP_API_URL` | both | runtime API base override |
| `FP_VAPID_KEY` | client | runtime push public-key override |

### Secrets hygiene

Real secret values (AWS keys, JWT secrets, DB password, VAPID private key) live ONLY in
`backend/.env`, which is gitignored. Never commit `.env`, screenshots containing tokens,
or pasted secrets. `.env.example` stays the committed template.
