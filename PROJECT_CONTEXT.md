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
backend/    NestJS API (code complete, hardened, + app-version endpoint)
admin/      Angular admin dashboard ("SN Bajaj And Co - Admin")
client/     Angular client PWA ("SN Bajaj And Co – GST Client Portal")
deploy/     Phase 5 deployment kit (see its README)
docs/       01–10 documentation set (08 handbook, 09 run guide, 10 deploy runbook)
design-references/  approved UI mockups
android-wrapper/    Android WebView app (com.snbajaj.portal) + store assets + debug APK
logo.jfif           source brand logo (1280x960) — regenerate icons from this
admin-web/, client-web/  stale empty planning folders — deleted Aug 25 2026
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
    `NODE_VERSION=22`). Custom domain `snbajaj.com` active. Deploy Hook NOT yet created
    (user's UI shows no Deploy hooks section) — after publishing a post, manually click
    Retry/Create deployment in the Pages dashboard until hook is wired.
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


## 11. Non-negotiable rules for contributors

1. Fixed stack — do not substitute technologies (§4).
2. Files never proxy through the API server — S3 signed URLs only.
3. No plaintext passwords; no public S3 URLs; no unencrypted traffic in prod.
4. Every reminder send and privileged admin action is logged.
5. Never commit secrets (`.env`, keys, VAPID private key). Only `.env.example` is committed.
6. Keep AWS cost minimal (Free Tier, one EC2, no paid services).
7. The user is cost-sensitive and new to cloud — keep things simple and documented.
