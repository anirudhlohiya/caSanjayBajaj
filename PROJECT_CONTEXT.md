# Project Context — CA Practice Management Platform

> This file is the single source of truth for any AI coding tool (Claude Code, Cursor,
> Copilot, etc.) working on this project. It reflects the project's CURRENT state after
> Phases 0–5 + Phases 6–8 (GST/ITR types, services, tickets). Treat everything below as
> fixed requirements unless explicitly told otherwise. Companion docs (read in this
> order): `docs/08-project-handbook.md` (deep context + gotchas),
> `docs/09-run-and-test-guide.md` (run/test locally), `docs/10-phase5-deploy-runbook.md`
> (deploy + security checklist).

## 1. What this project is

A platform for **SN Bajaj And Co** (chartered accountant firm — renamed Aug 2026 from
"CA Sanjay Bajaj & Co."; brand applied across all three apps, emails and the Android
launcher) to manage document collection, GST report delivery, filing reminders, services
showcase, and support tickets for ~150 GST clients + ~750 ITR clients.

Four components:

1. **Client PWA** ("SN Bajaj And Co – GST Client Portal") — Angular 20 installable
   mobile-first web app in `client/`. Clients log in (email+password or OTP
   signup/reset with optional GSTIN), upload documents per filing period directly to S3
   via pre-signed URLs, track document status, download GST reports, receive in-app
   notifications + email + browser web-push, browse services, and create support tickets.
2. **Admin web panel** ("SN Bajaj And Co – Admin") — Angular 20 dashboard in `admin/`,
   served at `/admin/` in production. The CA (super admin) and staff manage clients
   (GST vs ITR types), review documents, upload/send reports, send reminders, manage
   staff permissions, manage services offered, handle support tickets with file
   attachments, view audit logs, and manage filing periods.
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
Domain `snbajaj.com` is the primary domain. EC2 serves app/admin/api subdomains; the
marketing website is hosted on Cloudflare Pages.

## 3. User roles

| Role | Where | Access |
|---|---|---|
| **GST User** | Client PWA | Login/OTP signup (with GSTIN), upload documents per filing period, view status, download reports (full history), get reminders, browse services, create support tickets |
| **ITR User** | Client PWA | Login/OTP signup (name + email + phone only, no GSTIN), browse services, create support tickets (no document upload — ITR is Phase 2) |
| **Super Admin** (the CA) | Admin panel | Everything: clients (GST/ITR types), documents, reports, reminders, staff accounts, granular permissions, services CRUD, ticket management |
| **Staff Admin** | Admin panel | Limited access granted per-permission by Super Admin (`view_clients, view_documents, upload_reports, send_reminders, manage_staff, view_audit_logs, manage_settings, manage_services, manage_tickets`) |

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
- **Phase 6 (Aug 26 2026) — GST vs ITR Client Types + Pre-Registration — DONE**:
  - GST users must provide GSTIN + phone + email on signup; ITR users provide name + email + phone only (no GSTIN).
  - Backend `CreateUserDto` uses `@ValidateIf` for conditional GSTIN/phone validation based on `user_type` field.
  - `auth.service.ts` sets `user_type` to `gst` (if GSTIN present) or `itr` on signup.
  - `users.service.ts` enforces GSTIN uniqueness on account creation.
  - Admin form (`clients-list.ts/html`) dynamically shows required/optional labels based on account type.
  - Client PWA signup includes optional GSTIN field.
  - **Pre-registration entity** (`client_pre_registrations` table) allows admin to bulk-register GST clients before they self-register.
  - When a client signs up with a GSTIN matching a pre-registration, their account is auto-linked (`linked_user_id`).
  - **One-time import script**: `backend/scripts/import-clients.ts` reads Excel files (columns: name, email, phone, gstin, user_type) for bulk import of ~150 GST clients.
- **Phase 7 (Aug 26 2026) — Admin-Managed Services — DONE**:
  - New `services` table (`id, title, description, price, icon, display_order, is_active`).
  - Public `GET /api/v1/services` returns active services (ordered by `display_order`).
  - Admin CRUD at `/admin/services` (create, edit, deactivate, reorder).
  - Admin UI at `/services` route with add/edit modal.
  - Website (`index.astro`) fetches services dynamically from API on page load; hardcoded fallback if API unavailable.
- **Phase 8 (Aug 26 2026) — Ticket/Support System — DONE**:
  - New tables: `tickets` (subject, category, status: open/replied/closed, priority), `ticket_messages` (user_id, message, is_admin), `ticket_attachments` (message_id, filename, url, size, mime_type).
  - Backend: client endpoints `GET/POST /me/tickets`, `GET /me/tickets/:id`, `POST /me/tickets/:id/messages`, `POST /me/tickets/:id/close`; admin endpoints `GET/POST /admin/tickets`, `GET /admin/tickets/:id`, `POST /admin/tickets/:id/messages`, `POST /admin/tickets/:id/status`.
  - `StorageService.createTicketUploadUrl()` for ticket file attachments.
  - Admin UI: tickets list with status filters (`/tickets`), ticket detail with message thread and reply (`/tickets/:id`).
  - Client PWA: support tab in bottom nav (5-tab layout), ticket list (`/support`), new ticket form (`/support/new`), ticket detail with chat bubbles (`/support/:id`).
  - Services/Tickets nav items added to admin shell sidebar.
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
  recipients are rejected ("Email address is not verified"). REAL fix = user requests SES
  production access in AWS console. Push reminders show failed until a device subscribes.
- **PROD BUG-HUNT PASS (Aug 23, commit after `6bb0e49`) — all fixed & verified**:
  - **Service worker was breaking ALL client API GETs** (`net::ERR_FAILED` on every
    `/api/**` request through ngsw dataGroups cache) → root cause of "can't login /
    multiple errors". FIX: removed `dataGroups` from `client/ngsw-config.json` (API
    responses must never be SW-cached) + registered SW as `'ngsw-worker.js?v=2'` so
    existing poisoned installs are replaced by a fresh worker that claims the page.
    Verified with SW ACTIVE: login→dashboard works.
  - **S3 bucket had NO CORS config** → every browser upload/download failed with CORS
    errors while server-side PUTs worked. FIX: applied CORS rules to `ca-sanjay-gst-docs`
    (allowed origins lohiyaanirudh.tech/www/localhost:4200-1; GET/PUT/HEAD; headers *).
    NOTE: any new bucket needs the same config (aws s3api put-bucket-cors).
  - Client full E2E now passes 10/10 WITH service worker active: wrong-password error,
    login, dashboard, **document upload to S3 from browser**, reports, notifications,
    profile, password change round-trip, **real OTP signup flow end-to-end**
    (OTP read from pm2 logs for the test), signup→dashboard.
  - Admin click-sweep clean (only false-positive no-ops remain: Reset w/o filters,
    page-1 pagination). Sidebar Add-Client modal + inline duplicate-email error live.
  - Test artifacts cleaned: QA/test-local users deleted from prod DB (only real accounts
    remain); filing periods re-opened after automated sweeps accidentally closed them
    (sweep clicks the lock buttons — reopen via Settings if ever needed).

## 6. Functional notes (implemented)

- Auth: argon2 passwords; JWT access 15m + rotating refresh 30d (refresh tokens hashed in
  DB); OTP-based signup/forgot-password for clients (`otp_verifications` table).
  Tokens per surface: admin `fp_admin_access/refresh`, client `fp_user_access/refresh`
  (localStorage). GST users must provide GSTIN + phone; ITR users only name + email + phone.
- Pre-registration: admin-created records in `client_pre_registrations` table for bulk
  GST client onboarding. When a client signs up with a matching GSTIN, their account is
  auto-linked (`linked_user_id`). Import script: `npx ts-node scripts/import-clients.ts file.xlsx`.
- Document flow: client requests `POST /documents/upload-url` → PUTs directly to S3 →
  `POST /documents/:id/confirm`. Statuses `pending → received → processed`. Offline queue
  (IndexedDB) in client app.
- Report flow: admin uploads via pre-signed URL → confirm triggers in-app notification +
  FCM-style web push + SES email (link into app, NEVER raw attachment). Full report
  history kept per period/type (gstr_1, gstr_3b, reconciliation, other).
- Reminders: daily cron 08:00 server time (hardcoded; `REMINDER_CRON` env parsed but
  UNUSED) for open periods due within `REMINDER_LEAD_DAYS`; manual sends logged in
  `reminders` table visible in admin panel.
- Services: admin CRUD at `/admin/services`; public `GET /services` returns active services
  ordered by `display_order`. Website fetches dynamically; hardcoded fallback if API down.
- Tickets: clients create support tickets (subject, category, priority, description) and
  attach files. Threaded messages (user + admin). Status flow: open → replied → closed.
  Admin replies trigger in-app notification + email (when SES production access granted).
  File attachments uploaded via pre-signed S3 URLs.
- Seed (`npm run seed`): super admin from env + test client
  `client.test@snbajaj.com` (password `12345678`, set by user) + current+next-2
  filing periods (due 11th of following month). Test client is a REAL test account the
  user uses; do not delete. (Renamed from a personal gmail address Aug 25 2026; prod DB
  row updated to match.)
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

### 7b. Security audit + hardening pass (Aug 24 2026, commits d721c07 + 68f02bd)

Full codebase audit after the snbajaj.com cutover. Findings fixed and deployed to prod:
- **trust proxy (critical)**: Express did not trust nginx's X-Forwarded-For, so
  ThrottlerGuard saw every request as 127.0.0.1 — one shared bucket for ALL users
  (an attacker's brute-force would lock out everyone). `app.set('trust proxy', 1)`
  in main.ts restores per-client-IP buckets.
- **CORS double registration**: factory `{cors:true}` (ACAO:*) shadowed by later
  `enableCors(allowlist)` — removed; only the origin allowlist applies now.
- **OTP hashed at rest**: otp_verifications.otp_code now stores sha256 hash
  (`this.hashToken`), verify compares hashes. Old plaintext rows expire within
  minutes (TTL) — no migration needed.
- **OTP logging removed**: codes were printed to console on send.
- **Upload hardening**: contentType allowlist (pdf/images/office/csv/zip) via DTO
  `@IsIn`; filename rejects path separators; admin upload-url without user_id is a
  clean 400 (was a DB NOT NULL 500).
- **S3 lifecycle**: both buckets get abort-incomplete-multipart-uploads after 7 days
  (cost protection against stuffed uploads). NOTE: presigned PUT cannot enforce size;
  file_size_bytes is client-declared — residual cost risk accepted (private bucket,
  per-user prefixes, tiny user base).
- **Secrets scan clean**: full git history + working tree contain no real credentials
  (only doc placeholders AKIA.../ChangeMe_Local_1); no .env/.pem/keystore tracked;
  VAPID public key client-side by design; obsolete debug APK removed from git.
- OTP attempt-counter per record NOT added: risk assessed LOW (3/min throttle × 5-min
  TTL ≈ ≤15 guesses vs 1M space) — documented instead of schema change.


## 8. Repo layout

```
backend/    NestJS API (services-offered module, tickets module, import script)
admin/      Angular admin dashboard ("SN Bajaj And Co - Admin")
client/     Angular client PWA ("SN Bajaj And Co – GST Client Portal")
website/    Astro 5 marketing site + blog (snbajaj.com)
deploy/     Phase 5 deployment kit (see its README)
docs/       01–10 documentation set (08 handbook, 09 run guide, 10 deploy runbook)
design-references/  approved UI mockups
android-wrapper/    Android WebView app (com.snbajaj.portal) + store assets + debug APK
logo.jfif           source brand logo (1280x960) — regenerate icons from this
```

### Key new backend modules (Phase 6–8)

| Module | Path | Purpose |
|---|---|---|
| `ServicesOfferedModule` | `backend/src/services-offered/` | Admin CRUD + public GET for services offered |
| `TicketsModule` | `backend/src/tickets/` | Client + admin ticket management with threaded messages + attachments |
| `WebsiteModule` | `backend/src/website/` | Blog posts + enquiry leads (Phase 1–2) |

### Key new entities

| Entity | Table | Purpose |
|---|---|---|
| `ClientPreRegistration` | `client_pre_registrations` | Admin pre-registered GST clients for auto-linking on signup |
| `Service` | `services` | Admin-managed services displayed on website + client PWA |
| `Ticket` | `tickets` | Support tickets with subject, category, status, priority |
| `TicketMessage` | `ticket_messages` | Threaded messages within tickets (user + admin) |
| `TicketAttachment` | `ticket_attachments` | File attachments on ticket messages (S3 pre-signed URLs) |

### Key new migrations

| Migration | Purpose |
|---|---|
| `1787700000000` | Creates `client_pre_registrations` table |
| `1787700000001` | Creates `services` table |
| `1787700000002` | Creates `tickets`, `ticket_messages`, `ticket_attachments` tables |

Git: origin https://github.com/anirudhlohiya/caSanjayBajaj.git, branch `main`.

## 9. Explicit non-goals

No iOS/native app (PWA + optional thin wrapper later); no WhatsApp notifications (later);
no RDS; no multi-region/HA; no payments/billing; no FCM/Firebase (self-hosted VAPID push).

## 9b. Website migration project (Aug 2026) — snbajaj.com

Goal: move the firm's public face to **snbajaj.com** (purchased on Namecheap), host it
FREE on Cloudflare Pages, keep portal/admin/API on EC2 under subdomains, retire
lohiyaanirudh.tech by not renewing. Agreed layout: snbajaj.com/www = Astro marketing
site + blog; `app.` = client PWA; `admin.` = admin panel; `api.` = backend API.
Decisions locked: staff permission key `manage_website` added; leads save to DB AND
email the firm (`WEBSITE_LEAD_NOTIFY_EMAIL`, default casnbajaj2015@gmail.com); blog
content is Markdown written in admin panel; public posts are branded "S N Bajaj And Co".

Status:
- **Phase 0 DONE**: domain on Cloudflare NS (`alec`/`clara.ns.cloudflare.com`, verified
  resolving globally Aug 24 2026).
- **Phase 1 DONE (built & E2E-verified locally)**:
  - `website/` — NEW Astro 5 static site in repo root. 1:1 conversion of
    `exsiting website/` (DELETED Aug 25 2026 after confirming all 14 images the Astro site
uses live in `website/public/images`; content fully migrated). SEO done: meta/OG/Twitter,
    canonical, sitemap-index.xml (@astrojs/sitemap), robots.txt, LocalBusiness +
    Article JSON-LD, `_headers` security headers for Cloudflare Pages. Blog pages
    (`/blog`, `/blog/[slug]`) fetch published posts from the API at BUILD time via
    `PUBLIC_API_BASE_URL` (see `website/.env.example`); empty/failed API → site still
    builds with empty blog. Enquiry form POSTs JSON to `/website/leads` with honeypot
    field `company`. NOTE: Astro getStaticPaths is hoisted — API base must come from an
    imported module (`website/src/lib/api.ts`), NOT a frontmatter const.
  - Backend — `website/` module: tables `blog_posts` (slug unique, status draft/
    published, markdown in `content_md`) and `leads` (status new/contacted/closed,
    source_ip) via migration `1787563472838-AddWebsiteTables` (run locally OK; prod run
    pending cutover). Public endpoints: GET `/website/blog-posts[/:slug]`,
    POST `/website/leads` (5/min throttle, honeypot rejected). Admin endpoints under
    `/admin/website/*` guarded by new permission `manage_website`. Publishing/unpublishing/
    editing/deleting a live post fires Cloudflare Pages Deploy Hook from env
    `CLOUDFLARE_DEPLOY_HOOK_URL` (skipped silently if unset). New dep: `marked`.
    Audit actions: blog_post.create/.published/.draft/.delete.
  - Admin panel — new "Website" page (`features/website/`) with Blogs tab (create/edit/
    publish/unpublish/delete, markdown editor modal, auto-slug) + Enquiries tab
    (list/filter, mark contacted/closed/reopen); sidebar item shows with
    `manage_website`; staff page checkbox appears automatically. Builds green.
- **Phase 2 DONE (cutover executed Aug 24 2026)**:
  - Cloudflare Pages project `snbajaj-site` connected to repo (root dir `website`,
    build `npm run build`, output `dist`, env `PUBLIC_API_BASE_URL=https://api.snbajaj.com/api/v1`,
    `NODE_VERSION=22`). Custom domain `snbajaj.com` active. Deploy Hook CREATED Aug 25 2026
    (Workers builds hook, branch main) and set as prod `CLOUDFLARE_DEPLOY_HOOK_URL` —
    publishing/unpublishing a post now auto-rebuilds the site in ~1–2 min; verified end-to-end.
  - DNS: app./admin./api. = A records → 65.0.45.190, **DNS only (grey cloud)** so
    Let's Encrypt can validate directly; snbajaj.com/www point at Pages (proxied).
  - EC2: three new nginx confs in `/etc/nginx/conf.d/{app,admin,api}.snbajaj.conf`
    (portal + admin serve SPAs and proxy relative `/api/` to :3000 — CORS-free; api.
    proxies everything). Certbot issued one SAN cert for all three names with
    http→https redirects (`--redirect`). lohiyaanirudh.tech conf replaced with 301
    map: `/api/* → api.` (path kept), `/admin* → admin.` (path kept), `/ → snbajaj.com`,
    everything else → `app.` (PWA deep links). Old APK v1.0.0 users keep working via
    these redirects. Backups of prior conf in `/opt/ca-app/backups/`.
  - Prod deploy: repo pulled to fdd596a; rsync repo/backend → /opt/ca-app/backend
    (excl node_modules/dist/.env); npm ci; migration AddWebsiteTables RUN on prod;
    nest build; pm2 restart. `.env`: CORS_ORIGIN now lists all five origins
    (lohiyaanirudh.tech, app., admin., snbajaj.com, www). CLOUDFLARE_DEPLOY_HOOK_URL
    still unset (hook pending).
  - Admin SPA rebuilt locally & swapped into `/opt/ca-app/frontend/site/admin`
    (bundle main-VIXEWUYW.js); client PWA unchanged (no rebuild needed).
  - Android wrapper v1.0.1 (versionCode 2): APP_URL=https://app.snbajaj.com,
    API_BASE_URL=https://api.snbajaj.com/api/v1; debug APK built
    (android-wrapper/app/build/outputs/apk/debug/app-debug.apk) — user sideload pending.
  - E2E on prod: 13/13 PASS (admin login → create/publish post → public feed +
    markdown by slug → lead accepted from snbajaj.com origin → honeypot rejected →
    admin inbox shows lead → audit trail → cleanup; portal/admin shells 200 on their
    hosts; relative /api proxy works). All four redirect mappings verified 301.
- Gotchas hit during cutover (do not repeat):
  - Cloudflare Pages monorepo: leaving Root directory `/` fails ENOENT package.json —
    must be `website`.
  - Stale apex A record (auto-created at zone setup) blocks attaching the apex as a
    Pages custom domain ("externally managed DNS records") — delete it first.
  - Don't attach app/admin/api to the Pages project — they belong to EC2 as grey-cloud
    A records.
  - EC2 SG port 22 was IP-pinned; ISP rotates IPs (49.36.91.x) — update rule via AWS
    CLI when SSH times out (ca-backend IAM user has EC2 perms).
  - This nginx is Amazon-Linux style: configs live in /etc/nginx/conf.d/ (no
    sites-available). Reload is async — sleep before smoke-testing.
  - API response keys are snake_case (`access_token`); blog DTO field is `content_md`;
    publish/unpublish are POST, not PATCH; lead DTO uses `full_name`.
  - Known quirk: double CORS registration in main.ts (NestFactory cors:true +
    enableCors) yields ACAO:* instead of origin echo — harmless (Bearer auth, no
    cookies), revisit if tightening later.
- **Post-cutover incident (Aug 24 2026, fixed)**: admin panel blank at
  admin.snbajaj.com/admin/ — redeploying with plain `npm run build` emitted
  `<base href="/">` instead of `/admin/`, so the browser fetched assets from the wrong
  path and module scripts died on MIME errors. Fix: `"baseHref": "/admin/"` set
  permanently in admin/angular.json production config — ALWAYS rebuild admin with it
  (it's now automatic). Blog list page h2→h1 SEO fix shipped in same commit (fb0c052).
- **Browser E2E suite (Playwright + system Edge, headless)**: 25/25 checks across all
  four properties — marketing home/blog nav, enquiry form submit → lead lands in admin
  Enquiries tab → marked contacted; admin bad-login rejection, good login, sidebar
  modules, Website post create (auto-slug) → publish → visible in public API feed →
  delete, audit log entries visible ("blog_post · create"), staff page, logout; portal
  shell + invalid-login handling; old-domain redirect map. Zero unexpected console
  errors anywhere. Test harness lives outside repo (temp dir); artifacts cleaned from
  prod DB after runs.
- **Phase 3 PENDING**: Search Console + sitemap submission after cutover; www.snbajaj.com
  attach failed initially (stale-record error) and was NOT yet completed — retry Custom
  domains → www.snbajaj.com; SES DKIM verify snbajaj.com (3 CNAMEs) once user ready.
- **Admin UI Redesign & PWA Bugfix (Aug 25 2026)**:
  - Applied Vercel-inspired design language (`DESIGN.md` installed via getdesign tool) to the Admin Portal, upgrading to slate-50/white surface, black-ink buttons, custom cards with soft shadows, and emerald/rose/blue/indigo status badges.
  - Refactored `shell.html` sidebar to a clean stark white, styled navigation links, and added glassmorphic backdrop header.
  - Added `:host { display: flex; width: 100%; height: 100%; }` to `shell.ts` and `width: 100%` to `app.ts` to fix layout shrinking bugs under empty table states.
  - Fixed Client PWA `PageHeader` component bug where back button was evaluating but not executing the signal-wrapped callback.
  - Verified local and live E2E via browser subagent after deploying to production.
- **Client PWA Vercel Redesign (Aug 25 2026)**:
  - Updated `client/src/styles.css` Tailwind theme tokens to match Vercel design: slate-50 `#fafafa` background, neutral-950 `#171717` primary ink, `#0070f3` blue secondary accent, `#ebebeb` hairline borders, and soft stacked shadows.
  - Redesigned `shell.html` header to use `bg-white/90 backdrop-blur-md`, dark `bg-neutral-900` logo icon, and clean neutral bottom navigation with `bg-neutral-100` active state pill.
  - Redesigned `dashboard.html`: uppercase tracking section labels, neutral card icons, unified `.card` wrapper, and `bg-neutral-950` FAB.
  - Redesigned `documents.html`: `rounded-full` neutral chip filters, white backdrop bottom modal drawer, `bg-neutral-100` doc icons.
  - Redesigned `upload.html`: cleaner form select, white dashed drop zone, neutral progress bar, and `bg-neutral-900` primary upload button.
- **Client PWA Settings, Dark Mode, Profile Redesign & Brand Updates (Aug 25 2026)**:
  - Standardized the brand name as **"S N BAJAJ AND CO"** across client/admin titles, PWA manifests, login/signup forms, and backend SES templates/emails.
  - Copied `logo.jfif` to the admin assets directory (`admin/public/logo.jpg`) and updated the admin login and shell sidebar screens to display the image.
  - Created client `ThemeService` and Settings module (`/settings`) with support for System default, Light, and Dark modes (applying slate-50/neutral-950 Vercel tokens).
  - Redesigned Profile page with LocalStorage-backed base64 photo avatar upload and dynamic GSTIN details display card.
  - Added automatic notification permission checks on auth callbacks and a warning banner in the shell if permissions are denied.
  - Adjusted mobile FAB button positioning using CSS `clamp` sizing logic.
  - Seeded local DB container (`ca-pg`) and fully verified E2E flows through automated browser testing.
- **Client PWA UI Consistency Fix — Auth, Bottom Nav, Top Bar & Typography (Aug 27 2026)**:
  - Created shared `client/src/app/shared/components/auth-layout.ts` (`app-auth-layout` standalone) with unified hero header: `bg-neutral-950`, `size-12 rounded-xl bg-white/10 border-white/20 p-1.5` + `logo-login.png` (`h-full w-full object-contain` auto-fits any aspect), `S N Bajaj And Co` / `Chartered Accountants` hierarchy, `text-2xl font-bold` hero + `text-sm text-white/70` subtitle, decorative `bg-white/5` geometric blobs, and `-mt-8 rounded-t-3xl bg-white shadow-xl` card. Admin login left as separate centered card per user request.
  - Refactored all three client auth screens to use `AuthLayout`: `login.html/ts`, `signup.html/ts`, `forgot-password.html/ts` now share identical header/branding. Fixed `S N BAJAJ AND CO` ALL-CAPS → `S N Bajaj And Co`, unified labels (`Email` `text-xs uppercase tracking-wider`), inputs (`h-11 rounded-md border-neutral-200 bg-neutral-50 focus:border-neutral-900`), buttons (`h-11 rounded-lg bg-neutral-900 hover:bg-neutral-800`), and errors/footer links (`text-xs text-neutral-400/500`). Hero subtitles: `Welcome back / Sign in to your GST client portal`, `Create Account / Join S N Bajaj And Co`, `Reset Password / Recover your S N Bajaj And Co account`.
  - Fixed bottom navigation 4+1 wrap bug: `client/src/app/features/shell/shell.html:69` `grid-cols-4` → `grid-cols-5` with equal `1fr` spacing; all 5 tabs (`Home, Documents, Reports, Support, Profile` from `shell.ts:40`) now sit in single horizontal row with identical icon/label alignment and `bg-neutral-100` active pill. Stray black pill artifact under `Support` eliminated (was overflow from 4-col wrapping).
  - Fixed top app bar logo cropping: `shell.html:22` added `p-1` + `h-full w-full object-contain` + `shrink-0` so `logo-icon.png` auto-fits container (no square clipping). Same pattern in `auth-layout.ts:7`.
  - Fixed truncated subtitle on Support (`Get help with your doc…`): `client/src/app/shared/components/page-header.ts:8` removed `truncate` on subtitle, changed to `text-wrap` / `leading-snug` (`text-sm text-neutral-500`), title to `text-xl font-bold tracking-tight`, and wrapped `ng-content` in `shrink-0` div with parent `gap-3` + `min-w-0 flex-1` for proper flex constraints.
  - Normalized `client/src/styles.css:7` typography tokens per prompt spec: Screen Titles `24px bold` (`--text-headline-md 24px 700`), Subheadings `14px muted`, Section Headers `12px uppercase semibold tracking-wider` (`--text-label-lg 12px 600 0.05em`), Body `14px regular`, Badge `11px medium` (`--text-label-md`). `headline-md` weight `600→700`. Build verified: `client` `ng build` + `patch-sw.js` green (16.1s).

## 10. Open items

- **SES production access — ACTIVE BLOCKER for public signups (Aug 25 2026 runbook)**:
  OTP/reminder emails cannot reach arbitrary clients while SES is sandboxed. State:
  `ProductionAccessEnabled=false`, a PRIOR request was **DENIED** (case
  178759654800949, ~Aug 21 — likely because no sending identity was verified then).
  Progress made via CLI: `snbajaj.com` Easy-DKIM identity CREATED (tokens issued),
  account details set (TRANSACTIONAL / https://snbajaj.com / EN). Remaining USER steps:
  (1) paste 3 DKIM CNAME records `<token>._domainkey.snbajaj.com → <token>.dkim.amazonses.com`
  grey-cloud in Cloudflare (tokens in session log / re-fetchable via
  `aws sesv2 get-email-identity --email-identity snbajaj.com --region ap-south-1`);
  (2) after DKIM shows Verified, re-submit production access in SES console → Account
  dashboard → Request production access (transactional, use-case: OTP + reminders for
  registered clients of the CA practice, <200/day, suppression+VDM already enabled,
  contact casnbajaj2015@gmail.com). THEN server-side: pm2 restart and live OTP test
  through real signup — DONE AHEAD OF TIME: prod+local `SES_SOURCE_EMAIL` already set to
  `alerts@snbajaj.com` (Aug 25 2026; no mailbox behind it, one-way OTP sender). Sending
  stays broken until DKIM Verified + production access granted. NOTE: pre-existing email
  identity (casnbajaj2015@) shows UNVERIFIED — clicking its confirmation
  mail enables sandbox-mode testing to that address meanwhile.
- Browser-push live delivery test once a real device subscribes (Profile page).
- Android: sideload v1.0.1 debug APK (built, android-wrapper/app/build/outputs/apk/debug/)
  to verify shell against app.snbajaj.com; later Play release ($25 dev account) with
  signed AAB; then raise `APP_ANDROID_MIN_VERSION` on each release.
- Consider revoking `AmazonEC2FullAccess` from `ca-backend` IAM user now that infra is
  provisioned (S3+SES suffice for runtime).
- **Security audit DONE (Aug 25 2026, §7b)** — trust proxy / CORS / OTP hashing /
  upload allowlist fixes deployed; secrets scan clean; S3 MPU lifecycle rules added.
- **Cost check Aug 25 2026**: 1× t3.micro + single 20 GB gp3 volume, NO EIP, no
  snapshots, S3 ≈14 KB total. Well inside Free Tier while eligible (~$9/mo after).
  Orphaned eu-north-1 instance + 8GB volume terminated Aug 25 2026 (was costing
  ~$0.35/mo). Only remaining charge: public IPv4 ($0.005/hr = ~$0.36/mo). CloudWatch
  billing alarm set at $2/mo threshold; SNS topic `aws-billing-alerts` sends email to
  anirudhlohiya999@gmail.com (confirmation pending). AWS Budgets (weekly reports) requires
  root account to create — user instructions provided.
- **Logo fix Aug 25 2026**: other AI tool placed 1280×960 logo.jpg into tiny sidebar
  containers (32×32) — unreadable. Created `logo-icon.png` (128×128 center-crop) for
  sidebar/header icons and `logo-login.png` (256×256) for login pages. Deployed to both
  admin + client on server.
- **CREDENTIALS.txt**: repo root, not committed. Admin + client test login details.


## 11. Non-negotiable rules for contributors

1. Fixed stack — do not substitute technologies (§4).
2. Files never proxy through the API server — S3 signed URLs only.
3. No plaintext passwords; no public S3 URLs; no unencrypted traffic in prod.
4. Every reminder send and privileged admin action is logged.
5. Never commit secrets (`.env`, keys, VAPID private key). Only `.env.example` is committed.
6. Keep AWS cost minimal (Free Tier, one EC2, no paid services).
7. The user is cost-sensitive and new to cloud — keep things simple and documented.
