# Project Context — CA Practice Management Platform

> This file is the single source of truth for any AI coding tool (Claude Code, Cursor,
> Copilot, etc.) working on this project. It reflects the project's CURRENT state after
> Phases 0–5 + Phases 6–8 (GST/ITR types, services, tickets). Treat everything below as
> fixed requirements unless explicitly told otherwise. Companion docs (read in this
> order): `docs/08-project-handbook.md` (deep context + gotchas),
> `docs/09-run-and-test-guide.md` (run/test locally), `docs/10-phase5-deploy-runbook.md`
> (deploy + security checklist), `docs/11-lightsail-migration-runbook.md` (migration to
> Lightsail + CI/CD), `docs/12-interview-explanation.md` (interview-style walkthrough of the
> architecture and migration).

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
minimize AWS running cost (target ≈ ₹100–800/month):
- Single Lightsail `micro_3_1` (1 vCPU/2GB, ~$7/mo with free static IP, ~1 TB egress) runs
  EVERYTHING: API (PM2), PostgreSQL 16 (self-hosted, localhost-only), Nginx, both static
  SPAs. No RDS, no ALB, no ECS. (Migrated Sep 14 2026 from a billable EC2 t3.micro —
  see §9c.)
- Free-tier services only: S3 (private buckets, pre-signed URLs), SES email, self-hosted
  VAPID web push (NO Firebase/FCM account), Let's Encrypt SSL.
- No paid third-party services. Scale ceiling ~1000 users total — fine on one micro box.

## 3. Deployment priorities (user-stated order)

1. **Android app first** (client-facing) — wrapper code complete; needs live URL to load.
2. **Admin panel second** — must be reachable from any device after deploy.
3. **Client PWA last** (it's what the Android app wraps).
Domain `snbajaj.com` is the primary domain. Lightsail serves app/admin/api subdomains; the
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
- **DEPLOYED & LIVE (Sep 14 2026)**: https://app.snbajaj.com + https://admin.snbajaj.com on
  Lightsail `ca-platform-app` (Mumbai, static IP 3.111.8.176, $7/mo LOS bundle) — EC2
  t3.micro `i-09f7e0f0d3fc6414b` (IP 65.0.45.190, ap-south-1, ami al2023 ami-06a83a7a581c729a9)
  TERMINATED; legacy domain lohiyaanirudh.tech decommissioned (no redirects). See
  `docs/11-lightsail-migration-runbook.md`.
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
- **SES production access — IN PROGRESS (Sep 14 2026)**: SES was in sandbox
  (emails to unverified recipients rejected). IMPLEMENTED & DEPLOYED: a self-contained
  `SnsModule` (`backend/src/sns/*`) receives SES event notifications at
  `POST /api/v1/sns/notifications`, verifies the AWS SNS signing certificate
  (host-pinned to `sns.<region>.amazonaws.com`), auto-confirms topic subscriptions,
  and processes Bounce/Complaint events. Permanent bounces and complaints set a new
  `users.email_suppressed_at` timestamp; the send pipeline checks it in `NotificationsService.sendEmail`
  before every SES call, blocking further sends to suppressed addresses and logging
  to `audit_logs`. **Remaining user steps**: (1) create SES Configuration Set +
  Event Destination (Bounce/Complaint → SNS topic); (2) subscribe
  `https://api.snbajaj.com/api/v1/sns/notifications` as an HTTPS endpoint
  (handler auto-confirms); (3) enable the SES account-level suppression list;
  (4) set `SNS_TOPIC_ARN` in `/opt/ca-app/backend/.env` + `pm2 restart ca-api`;
  (5) submit the appeal letter (`aws_response_resubmit.txt`, placeholders
  `[YOUR_CONFIG_SET]` / `[YOUR_SNS_TOPIC_ARN]`) to AWS support.
- **PROD BUG-HUNT PASS (Aug 23, commit after `6bb0e49`) — all fixed & verified**:
  - **Service worker was breaking ALL client API GETs** (`net::ERR_FAILED` on every
    `/api/**` request through ngsw dataGroups cache) → root cause of "can't login /
    multiple errors". FIX: removed `dataGroups` from `client/ngsw-config.json` (API
    responses must never be SW-cached) + registered SW as `'ngsw-worker.js?v=2'` so
    existing poisoned installs are replaced by a fresh worker that claims the page.
    Verified with SW ACTIVE: login→dashboard works.
  - **S3 bucket had NO CORS config** → every browser upload/download failed with CORS
    errors while server-side PUTs worked. FIX: applied CORS rules to `ca-sanjay-gst-docs`
    (allowed origins app./admin./api./snbajaj.com/www/localhost:4200-1; GET/PUT/HEAD; headers *).
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
- **Auth UI Redesign (Sep 2026) — DONE**:
  - Completely overhauled the auth screens (Login, Signup, Forgot Password) using a dedicated 
    Tailwind-based design (Stitch). 
  - Centralized global brand colors/typography inside `styles.css` using Tailwind v4 `@theme`.
  - Fully transparent logo loaded cleanly on auth UI. Form validation logic intact.
- **Phase 9 (Sep 2026) — Automated Rent Agreements (Admin Only) — DONE**:
  - New table `rent_agreements` (`id, title, description, client_name, client_phone, client_email, start_date, end_date, template_id, status, s3_key, docx_s3_key, created_by`).
  - Implemented dynamic DOCX template engine using `docxtemplater` and `pizzip`. Templates are defined in `backend/src/rent-agreements/templates/config.ts` with expected fields (text, date, select, multiline, and arrays for loop tags like licensors/licensees).
  - **Backend**: endpoints `POST /admin/rent-agreements` (generates the filled DOCX from the template, uploads to S3, saves to DB), `GET /admin/rent-agreements` (paginated list), `GET /admin/rent-agreements/:id/download/docx`, `POST /admin/rent-agreements/preview` (HTML preview), and `POST /admin/rent-agreements/convert-to-docx` (edited HTML → DOCX round-trip).
  - **Admin UI**: new `/rent-agreements` list page and a dynamic creation form at `/rent-agreements/new` that auto-renders inputs (including dynamic FormArrays for licensors/licensees) based on the chosen template's config.
- **Rent-Agreement fixes (Sep 2026) — DONE (local, NOT yet committed/deployed)**:
  - **Template repair (`docs/templates/repair-template.js`)**: original `TOWER-1-804.docx` used double braces `{{...}}` but docxtemplater@3.69.3 defaults to single braces — rendered so badly it looked "corrupted". Repaired to `TOWER-1-804-fixed.docx` (single-brace, section tags converted to `{#tags}`/`{/tags}`), now the config target; rendered output verified against real data.
  - **Corruption bug #2 (frontend download URL)**: `RentAgreementsService.getDownloadUrl()` returned a RELATIVE `/api/v1/...` URL while the admin SPA runs on a different origin than the API in dev (no proxy). The relative path resolved to the admin origin → returned `index.html` → Word reported the file corrupted. FIXED: URL now built from `ApiClient.baseUrl` → `` `${this.api.baseUrl}/admin/rent-agreements/${id}/download/docx` `` (same fix used on both create + list pages; preview already used `baseUrl`).
  - **Cover/first page missing from preview**: the cover (title, `{PROPERTY_ADDRESS}`, LICENSOR names, LICENSEE names) lives in floating **textboxes** (`wp:wgp > wp:grpSp > wp:wsp > wp:txbx > wne:txbxContent`) which `mammoth` deliberately skips. Replaced mammoth with a custom converter `backend/src/rent-agreements/docx-to-html.ts` (uses `@xmldom/xmldom`): renders paragraphs, runs (b/i/u/strike/size/fonts), tables, `w:br w:type="page"` → `<div class="page-break">`, and textbox content via `appendTextboxBlocks`. Converter bug note: `renderParagraph` must call `renderRun()` directly for `w:r` children (feeding a run to `renderInlineRuns` drops its `w:t` text).
  - **Cover names were blank**: cover textbox still used the original uppercase `{NAME}` tag while the body uses `{name}` → nullGetter emptied it. FIXED service-side: licensors/licensees map now adds a `NAME` alias (`...person, NAME: person.name`) alongside `abbreviation`/`age`.
  - **Editable WYSIWYG-ish preview (Sep 2026)**: added `html-to-docx@^1.8.0` (backend). The preview modal became a contenteditable `#editableDoc` A4-style page with a formatting toolbar (execCommand: bold/italic/underline/strike/lists/align/undo/redo) so admins can edit the rendered document on the spot and click **Download Edited DOCX** → `svc.docxFromHtml(html)` (Times New Roman, fontSize 22) → `convert-to-docx` buffer (Word content-type, attachment disposition). Full pipeline E2E-verified on the compiled service: cover + body + page break + names present in preview HTML; edited-docx round-trip is a valid zip preserving the content.
  - *Known Gotcha*: the base template's floating-textbox layout (page-positioning) is flattened by the HTML converter (cover text renders as flow paragraphs) — acceptable for the editable-preview approach. html-to-docx has NO page-break option, so the exported edited DOCX may compact page structure vs. the original template.
  - **OnlyOffice self-hosted Word editor (Sep 2026) — IN PROGRESS (backend + admin UI done, NOT yet committed/deployed, needs OnlyOffice Document Server on EC2 + env)**:
    - Gives a TRUE WYSIWYG Word editor (real page layout incl. textboxes) so admins see exactly what the final DOCX looks like and can edit it directly. This is the recommended integration chosen by the user; the contenteditable preview from the previous fix remains as a lightweight fallback.
    - **Backend env/config**: `onlyOffice` block in `configuration.ts` + `.env.example` vars — `ONLYOFFICE_ENABLED=false` (gate), `ONLYOFFICE_SERVER_URL=https://office.snbajaj.com` (the Document Server origin the frontend iframe/API script loads from), `ONLYOFFICE_JWT_SECRET=` (leave blank to disable JWT signing of the editor config; if set, the full editor config is JWT-signed and passed as `config.token`), `API_BASE_URL` reused for `onlyOffice.apiBaseUrl` (publicly reachable API origin the Document Server calls back to).
    - **Entity/migration**: `rent_agreements.edited_docx_s3_key` (varchar 500, nullable) added via `backend/src/database/migrations/1790000000001-AddRentAgreementEditedDocx.ts`; stores the S3 key of the file saved back from the Word editor.
    - **Endpoints**:
      - `GET /admin/rent-agreements/:id/office/config` (guarded) → `{ serverUrl, config }` where `config` is the full OnlyOffice `DocsAPI.DocEditor` config (documentType `word`, `document.url` = server-side source URL, `editorConfig.callbackUrl`, JWT token if secret configured). Generates the docx buffer on demand and caches it in an in-memory `officeSessions` Map (key = uuid, 2h TTL).
      - `GET /admin/rent-agreements/office/source/:key` (unguarded, key = secret uuid) → streams the cached docx buffer to the Document Server.
      - `POST /admin/rent-agreements/office/callback/:key` (unguarded) → handles OnlyOffice save callbacks (status 2 "ready to save" / 6 "force save"): fetches the edited file from `body.url`, uploads to S3 as `rent-agreements/{id}/edited.docx`, updates `edited_docx_s3_key`, replies `{ error: 0 }`; other statuses reply `{ error: 0 }` (no-op); download failures reply `{ error: 1 }`. New controller `RentAgreementsOfficeController` (separate from the guarded controller so the Document Server can call back without an admin Bearer token).
      - `GET /admin/rent-agreements/:id/download/docx` now serves the S3-saved edited file first (when `edited_docx_s3_key` is set), falling back to regenerating from `form_data`.
    - **Admin UI**: new `OfficeEditor` component (`admin/src/app/features/rent-agreements/office-editor.ts`) — modal that loads `{serverUrl}/web-apps/apps/api/documents/api.js`, constructs `new DocsAPI.DocEditor(host, config)`, destroys on close. "Edit in Word" buttons added to both the list page and the create page (create auto-saves a draft if no id yet). Service method `RentAgreementsService.getOfficeConfig(id)`.
    - **Verification**: compiled-service unit test (`C:\Users\Admin\AppData\Local\Temp\opencode\office-test.js`) passes — config shape, JWT token presence, source buffer/TTL, callback save→S3→DB update, no-op on closed, error on failed download, edited-docx-first download. Deployed-only test still needed with a real Document Server + S3 + env.
    - *Ops caveats*: OnlyOffice Document Server Community Edition is free with a fair-use limit (~20 concurrent connections); README recommends ~2GB RAM (t3.micro has 1GB — may need t3.small). Runs as a Docker container `onlyoffice/documentserver`; nginx vhost (e.g. `office.snbajaj.com`) reverse-proxying to it, plus certbot TLS, with `ONLYOFFICE_ENABLED=true`, `ONLYOFFICE_SERVER_URL=https://office.snbajaj.com`, `ONLYOFFICE_JWT_SECRET` set on the API env. Run the new migration first.`

- **Phase 10 (Sep 2026) — Compliance Task Checklist — DONE**:
  - **Backend**: Created a new `ComplianceTask` entity and migration script for `compliance_tasks`. Added `ComplianceCategory` enum (GSTR-1, GSTR-3B, Sales Bills, Purchase Bills, IFF, GST Payment). Endpoints allow for generation based on monthly vs quarterly intervals and manually marking task statuses (completed, updating payment amounts).
  - **Admin UI**: Added a Compliance Checklist dynamically linked to a specific client period on the `client-detail.html` screen, allowing Admins to see progress and manually update GST payments.
  - **Client UI (Documents)**: Revamped `Documents` list to pull dynamically from actual generated `ComplianceTask` data (differentiated by status, indicating if upload is required or completed).
  - **Client UI (Reminders)**: Created a new detailed Reminders screen showing "Needs Attention", "Upcoming", and "Completed" categories (matching the required Figma design).
- **Phase 11 (Sep 2026) — GST Automation M1-M7 — DONE**:
  - Implemented automated period generation (monthly/quarterly based on user frequency), automated nil filing logic, auto-reminders, and compliance task integration. S3 lifecycle policy created for expiring old reports and docs. Import script handles bulk client frequency.
  - Rewired the client portal's Home, Documents, and Reminders tabs to fetch real data from the backend `ComplianceTasks`.
  - Replaced the raw JSON text area in `Settings -> Filing Periods` with a robust **Schedule Editor** interface that lets admins visually update the deadlines and reminder dates for GSTR-1, GSTR-3B, IFF, and Payments without writing JSON.
- **Phase 12 (Sep 2026) — GST Automation gaps closed (`docs/13-gst-automation-plan.md`) — DONE**:
  - **Backend M1–M5**: `users.gst_filing_frequency` (monthly/quarterly) + audit on change; `gst_filing_periods.schedule` JSONB validation + audit on edit; `view_clients` permission enforced on admin compliance endpoints (nil confirm/queue, payment amount, task status); scheduled `TASK_REMINDER_CRON` (08:00 server, date-driven copy, dedupe, audit) registered via `SchedulerRegistry`; document confirm now links the upload to the matching `compliance_tasks` row (sets status `uploaded`). New dep: `@nestjs/schedule` `cron`, `@types/pg` (dev).
  - **Share-link flow fixed**: `report_share_links` stores only the sha256 `token_hash` (raw token delivered to the recipient via email → 302 redirect to signed download). Full-flow supertest e2e (`test/compliance-flow.e2e-spec.ts`, gated by `E2E_ENABLED=true`, ephemeral DB) green 5/5: health, period create→auto-task, nil→confirm (audit), upload→UPLOADED, report-request→fulfill→share-link row. Unit 98/98, lint clean, `nest build` clean.
  - **Admin UI**: client cadence inline editor on `client-detail`; Edit modal on `clients-list` (name/phone/GSTIN/status/frequency); Settings add-period form auto-prefills schedule from the period code via `defaultScheduleFor` (mirrors backend: GSTR-1 due 11th+rems 5/7/11, GSTR-3B due 20th+rem 18th, IFF due 13th+rems 5/7/11, payment no rems; quarterly GSTR-3B settling 22nd+rem 20th).
  - **Client UI**: `documents.ts/html` rewritten — real current-period card (label + cadence + due + progress), real doc tasks (upload/nil/uploaded/paid), payment shown as **info-only chip (`₹amount`) with no upload**, "From Your CA" shares real reports with download, "Filed Returns" requests real reports from the backend. Reports screen filters genuinely-pending requests + real status badges. Reminders screen de-legacy-ified: no `sales_bills`/`purchase_bills`/`overdue` mocks; needs-attention = pending-with-due-within-2-days or `nil_declared`.
  - **CI**: new `.github/workflows/ci.yml` (backend lint+test+build, admin `--base-href=/admin/` build, client build) alongside `deploy.yml`.
  - **Deviation note (per §11 rule 1)**: nil admin endpoints keep their existing `/compliance-tasks/admin` paths; they only GAINED the `view_clients` guard — no path renames (do not "fix" to `/admin/compliance-tasks/*`).

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
  `client.test@snbajaj.com` (password `Client@2026`, defined in
  `backend/src/database/seed.ts` — NOT `12345678` as earlier docs said; the seed source
  is authoritative) + current+next-2 filing periods (due 11th of following month).
  Test client is a REAL test account the user uses; do not delete. (Renamed from a
  personal gmail address Aug 25 2026; prod DB row updated to match.)
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

### Key new backend modules (Phase 6–9)

| Module | Path | Purpose |
|---|---|---|
| `ServicesOfferedModule` | `backend/src/services-offered/` | Admin CRUD + public GET for services offered |
| `TicketsModule` | `backend/src/tickets/` | Client + admin ticket management with threaded messages + attachments |
| `WebsiteModule` | `backend/src/website/` | Blog posts + enquiry leads (Phase 1–2) |
| `RentAgreementsModule` | `backend/src/rent-agreements/` | Admin DOCX template generation, HTML preview, and OnlyOffice Word-editor (config/source/callback) endpoints |

### Key new entities

| Entity | Table | Purpose |
|---|---|---|
| `ClientPreRegistration` | `client_pre_registrations` | Admin pre-registered GST clients for auto-linking on signup |
| `Service` | `services` | Admin-managed services displayed on website + client PWA |
| `Ticket` | `tickets` | Support tickets with subject, category, status, priority |
| `TicketMessage` | `ticket_messages` | Threaded messages within tickets (user + admin) |
| `TicketAttachment` | `ticket_attachments` | File attachments on ticket messages (S3 pre-signed URLs) |
| `RentAgreement` | `rent_agreements` | Stores generated DOCX agreements and input fields |

### Key new migrations

| Migration | Purpose |
|---|---|
| `1787700000000` | Creates `client_pre_registrations` table |
| `1787700000001` | Creates `services` table |
| `1787700000002` | Creates `tickets`, `ticket_messages`, `ticket_attachments` tables |
| `1789000000000` | Creates `rent_agreements` table |

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
    http→https redirects (`--redirect`). A temporary 301 map for the legacy
    lohiyaanirudh.tech (kept old APK v1.0.0 deep links working) was in effect until the
    Lightsail migration (Sep 14 2026), when the domain was fully decommissioned — no
    redirects remain.
  - Prod deploy: repo pulled to fdd596a; rsync repo/backend → /opt/ca-app/backend
    (excl node_modules/dist/.env); npm ci; migration AddWebsiteTables RUN on prod;
    nest build; pm2 restart. `.env`: CORS_ORIGIN lists (app., admin., snbajaj.com, www;
    lohiyaanirudh.tech removed Sep 14 2026). CLOUDFLARE_DEPLOY_HOOK_URL
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

- **Client PWA Dark Mode Fix (Sep 8 2026)**:
  - Fixed a CSS specificity bug where light mode `.card` in `@layer components` aggressively overrode the dark mode `.dark .card` in `@layer base`. Moved `.dark .card` to `@layer components` to restore dark background and borders.
  - Added `@custom-variant dark (&:is(.dark, .dark *));` to `styles.css` to enable Tailwind v4 class strategy toggle (since the app relies on dynamic `.dark` class rather than OS `prefers-color-scheme`).
  - Automated injection of `dark:` utility classes (e.g., `dark:bg-neutral-900`, `dark:text-white`) across ALL 14 HTML screens in the client portal via `scripts/fix-dark-mode.js`. **Crucial Rule**: Tailwind v4 class-based dark mode requires explicitly defining both states if variables are not used. Always use `dark:` variants when hardcoding Tailwind colors to ensure dark mode works.
  - Synced `<meta name="theme-color">` dynamically in `theme.service.ts` so the Android WebView status bar adapts cleanly to dark/light mode toggles.

- **Device-Responsive PWA + Portrait Lock (Sep 8 2026)**:
  - Made the Client PWA fully device-friendly — responsive on ANY screen size (phone, tablet, desktop, web browser, Android WebView). Removed the old `max-w-md` (448px) narrow-column constraint that kept the app in a phone-width column on larger screens.
  - Shell (`client/src/app/features/shell/shell.html`) now uses `max-w-5xl` (1024px) for the content container; header, main content, and bottom nav all align within it. Content area and nav adapt fluidly.
  - Feature pages use responsive grid classes (`responsive-list`, `responsive-toolbar`) for multi-column layouts on ≥768px/≥1024px viewports — documents, reports, support tickets, notifications render in 2-column grids on tablets/desktops.
  - Profile, Settings, Upload, New Ticket, Ticket Detail pages constrain to `max-w-2xl` (672px) for comfortable reading/writing on wide screens.
  - CSS utilities added in `client/src/styles.css`: `.app-shell-container`, `.app-bottom-nav`, `.responsive-grid`, `.responsive-list`, `.responsive-toolbar`, `.responsive-sheet` (bottom-sheet modals become centered dialogs on ≥640px).
  - **Portrait lock**:
    - Android: `android:screenOrientation="portrait"` added to `MainActivity` in `android-wrapper/app/src/main/AndroidManifest.xml`.
    - PWA: `"orientation": "portrait"` added to `client/public/manifest.webmanifest`; `screen.orientation.lock('portrait')` called in `client/src/index.html` (fallback silently on unsupported).
- **Local phone testing on same Wi-Fi (Sep 8 2026)**:
  - Dev client PWA base URL is overridable ONLY via `client/src/environments/environment.ts` (built in at compile time — dev server auto-reloads on save). It was changed from `http://localhost:3000/api/v1` to `http://192.168.31.26:3000/api/v1` (the dev machine's LAN IP at the time) so a phone on the same Wi-Fi can reach the local API. If the machine's LAN IP changes (`Get-NetIPConfiguration`), update this file again and save.
  - To expose the Angular dev server to the LAN it MUST be started with `--host 0.0.0.0` (default binds loopback only). Example: `cd client; npx ng serve --host 0.0.0.0 --port 56191`. Backend (NestJS `app.listen()`) already binds 0.0.0.0 by default — reachable at `http://<PC-LAN-IP>:3000`.
  - Windows Firewall: if Wi-Fi profile is **Public** (Windows default for new networks), inbound to Node is usually blocked. Needs an ADMIN PowerShell: `New-NetFirewallRule -DisplayName "SN Bajaj Node Dev" -Direction Inbound -Action Allow -Protocol TCP -Program "C:\Program Files\nodejs\node.exe" -Profile Any`. (Non-admin attempts fail with "Access is denied".)
  - Phone then loads the app at `http://<PC-LAN-IP>:56191`. NOTE: `http://192.168.x.x` is NOT a secure context → web push/notifications will not work there (see docs/09 §10); document upload/download (S3 via signed URLs) still works. OTP signup/forgot-password emails won't arrive (SES sandbox) — use the seeded password login instead.

- **Client PWA Feature Overhaul (Sep 2026)**:
  - **Complete UI Refresh**: Redesigned Home Dashboard, Services page, Notifications, and Profile screens incorporating dynamic dark mode styling. New designs reflect an upgraded premium aesthetic with a unified 5-tab navigation.
  - **Multi-language Support**: Integrated `@ngx-translate/core@18.0.0` (with `provideTranslateService` and `TranslatePipe`) to allow users to seamlessly switch between English, Hindi, and Gujarati. Settings page now manages `fp_language` stored in localStorage.
  - **Payment Options**: Integrated payment details into the Settings page, allowing users to view bank details (IDBI Bank) and a downloadable QR code modal (`payment-qr.jpeg`).
  - **Dependencies updated**: Removed deprecated `TranslateModule` pattern in favor of Angular 18+ compliant provider API for `ngx-translate`.

## 9c. Lightsail migration + CI/CD deploy (Sep 14 2026)

Moved the whole stack OFF the billable EC2 t3.micro (was ~$9–13/mo incl. public-IPv4
charge) onto a single Lightsail bundle (~$7/mo, all-in), and made GitHub Actions the
automatic deploy pipeline. **Extended runbook: `docs/11-lightsail-migration-runbook.md`.**

### Infra (current production)
- Lightsail instance **`ca-platform-app`** — region `ap-south-1` (Mumbai), AZ
  `ap-south-1a`, bundle `micro_3_1` (1 vCPU / 2 GB / ~$7/mo), Amazon Linux 2023.
  (Instance name is `ca-platform-app` because `ca-platform` was already taken by the
  Lightsail key pair — resource names are unique per region by type.)
- Static IP **`ca-platform-ip` → `3.111.8.176`** (FOREVER static, free while attached —
  if the instance is ever deleted, detach OR delete it so it doesn't bill).
- SSH key: `F:\Anirudh\lightsail-key.pem` (also = GitHub secret `DEPLOY_SSH_KEY`);
  ACL-locked on Windows via .NET (icacls tool bug). Old EC2 key `ca-platform-key.pem` is DEAD.
- Instance firewall (Lightsail "networking") must be kept open: `22`, `80`, `443`.
  **Gotcha:** CLI-created instances default to only 22+80 — 443 was missing and had to
  be added (`aws lightsail open-instance-public-ports`, `--port-info` JSON via a file).

### Server layout (all inside the one box)
- `/opt/ca-app/repo` — git clone of `anirudhlohiya/caSanjayBajaj` (updated by CI via
  `git fetch origin && git reset --hard origin/main`).
- `/opt/ca-app/backend` — release backend = repo's `backend/` (npm ci → `migration:run`
  → `nest build` happen there during each deploy). `.env` lives NEXT to it:
  `/opt/ca-app/backend/.env`, chmod 600, **not in the repo**.
- `/opt/ca-app/frontend/site` — client PWA web root; `site/admin/` = admin SPA.
- PM2 app **`ca-api`** (id 0, ec2-user) via `deploy/ecosystem.config.js`,
  boot-persisted (`pm2 startup`). Release = `pm2 startOrReload`.
- nginx: AL2023 style → `/etc/nginx/conf.d/ca-platform.conf` (multi-block: app/admin/api,
  TLS + http→https 301). NOT auto-synced by CI — it must be re-deployed with
  `deploy/configure-nginx.sh` / scp when changed.
- Node 22 (nodesource `setup_22`), global PM2; PostgreSQL 16 (server packages),
  database `ca_sanjay_gst` (fresh), DB superuser password in server `.env`.

### LibreOffice (rent-agreement PDF preview)
- AL2023 has NO `libreoffice` rpm — installed the official RHEL bundle
  `LibreOffice_26.2.6.3_Linux_x86-64_rpm` to `/opt/libreoffice26.2` plus X11 runtime libs
  (libXinerama/libXrandr/libX11-xcb/cairo/liberation-fonts …). Headless conversion
  VERIFIED working as ec2-user (`soffice --headless --convert-to pdf`).
- `/tmp` is **tmpfs (RAM)** on AL2023 — always use `/var/tmp` for downloads/extract.
- Driven by env in server `.env`: `LIBREOFFICE_ENABLED=true`,
  `LIBREOFFICE_BINARY=/opt/libreoffice26.2/program/soffice`,
  `LIBREOFFICE_TIMEOUT_MS=60000`.

### DNS / TLS
- `snbajaj.com` lives in Cloudflare (zone id `03969891186fb0b2408edb5e696165ba`; token
  saved locally in `cloudfare.txt` — gitignored — and server-side at
  `/etc/letsencrypt/cloudflare.ini`, root 0600).
- A records `app.` / `admin.` / `api.snbajaj.com` → **`3.111.8.176`**, DNS-only (grey
  cloud, not proxied) so Let's Encrypt validates directly. `snbajaj.com`/`www` → Cloudflare
  Pages (proxied).
- TLS: ONE Let's Encrypt cert `ca-platform` (SAN app+admin+api), issued via **manual
  dns-01** using hook scripts `deploy/cf-dns-auth.sh` / `cf-dns-clean.sh` (create/delete
  `_acme-challenge` TXT through the Cloudflare API). Cert valid until 2026-12-13, auto-renew
  scheduled. Keep token current in `/etc/letsencrypt/cloudflare.ini` or renewal breaks.
- **`lohiyaanirudh.tech` FULLY DECOMMISSIONED (Sep 14 2026)** — registrar-managed (Namecheap,
  NOT in Cloudflare), previously only 301-redirected. Zero redirects remain; removed from
  server `.env` (`API_BASE_URL`, `FIREBASE_VAPID_SUBJECT`, `CORS_ORIGIN`) and never added to
  nginx. Leave its DNS dead.

### Database (fresh + seeded)
- Wiped/replaced with a brand-new `ca_sanjay_gst`: 21 tables, all migrations applied
  including `AddRentAgreementSoftDelete1792000000003` (rent-agreements features live:
  LibreOffice PDF preview, soft delete, summary stats for admin cards).
- Seeds: super admin `sanjay@gmail.com` (password in server `.env`/CREDENTIALS.txt),
  test client `client.test@snbajaj.com`, filing periods Sep/Oct/Nov 2026.

### CI/CD — THE release path (push to main = release)
- Workflow `.github/workflows/deploy.yml`, repo is PUBLIC (`anirudhlohiya/caSanjayBajaj`),
  triggers on push to `main` (paths: `admin/**`, `client/**`, `backend/**`,
  `docs/templates/**`, `deploy/**`, the workflow itself) + `workflow_dispatch`.
- Steps: checkout → setup Node 22 (npm cache) → build admin
  (`ng build --configuration production --base-href=/admin/`) → build client PWA → package
  tar → `scp` to server → ssh `SKIP_BACKEND=0 bash deploy/release-on-server.sh` →
  HTTPS smoke test.
- Secrets (repo → Settings → Secrets): `DEPLOY_HOST=3.111.8.176`, `DEPLOY_USER=ec2-user`,
  `DEPLOY_SSH_KEY` = **full contents** of `F:\Anirudh\lightsail-key.pem`.
- `deploy/release-on-server.sh` (shared with local PowerShell deploy):
  `git fetch origin && git reset --hard origin/main` → backend npm ci + `migration:run` +
  `nest build` → rsync frontend bundle into `/opt/ca-app/frontend/site` (+ atomic admin
  swap, extract OUTSIDE web root!) → `nginx -t` + reload → `pm2 startOrReload ca-api` →
  health check.
- **CI failure fixed (Sep 14)**: the final `curl -fsS http://127.0.0.1:3000/api/v1/health`
  was a one-shot check that fired ~3s after `pm2 reload`, while NestJS was still booting →
  `curl: (7) ... Could not connect` → run FAILED. FIX: retry loop (20×3s) in
  `deploy/release-on-server.sh`. All runs green since (`34822197224` success).
- Smoke test uses `curl -fsSk "https://$DEPLOY_HOST/api/v1/health"` (IP has no SNI → `-k`).

### Backups
- Nightly **02:30** cron (ec2-user): `/opt/ca-app/bin/backup.sh` → `pg_dump ca_sanjay_gst`
  | gzip → `s3://ca-sanjay-backups/postgres/` (+ keep 3 local copies). Cron verified
  installed (Sep 14 — it had been skipped when bootstrap aborted); manual run OK.

### Old EC2
- `65.0.45.190` (`i-09f7e0f0d3fc6414b`) — **TERMINATED Sep 14 2026** after cutover was
  fully verified. No EC2 cost remains (billing is effectively just Lightsail ~$7/mo).

### Verification (all done, all passing)
- `https://app.snbajaj.com|admin.snbajaj.com/admin/|api.snbajaj.com/api/v1/health` → 200;
  certs verify as browser-trusted (`ssl_verify_result=0`); HTTP→HTTPS 301 works.
- Admin login end-to-end → real `access_token`/`refresh_token`.
- `/api/v1/admin/rent-agreements/summary` → 401 (guarded → route live).
- LibreOffice headless txt→pdf works as ec2-user; `soffice --headless --version` OK.
- Manual backup uploaded to S3; nightly cron present.
- `git push origin main` → Actions run `conclusion=success`.

### Windows dev-box gotchas (hit constantly, do not repeat)
- PowerShell `curl` is ALIASED to `Invoke-WebRequest` — use **`curl.exe`**.
- `aws`/`ssh` recipes: PowerShell strips inner double-quotes from args; for raw JSON pass a
  file (`file://...json`). Parentheses, `$()`, backticks, `\n` inside one-line ssh commands
  get mangled → **write a `.sh` locally, LF-normalize, `scp`, then `bash` it**.
- `git credential fill` can surface the stored GitHub PAT (use via `gh`-less API reads).
- LF/CRLF: git on Windows writes CRLF in working copies — always LF-normalize `.sh`/conf
  before sending to the server.

## 10. Open items

- **SES production access — appeal letter pending**: backend pipeline is
  implemented, deployed and live (verified: `POST /api/v1/sns/notifications`
  returns 200 for any parseable SNS message, including unsigned validation
  probes, which previously caused "Unreachable Endpoint"). The suppression
  list (`users.email_suppressed_at` + `NotificationsService.sendEmail` gate
  + audit_logs) is active. **To complete**: (a) create a Configuration Set
  (e.g. `gst-alerts`) + SES Event Destination (Bounce + Complaint → SNS
  topic) in the SES console; (b) create/confirm an SNS subscription to
  `https://api.snbajaj.com/api/v1/sns/notifications` (HTTPS, auto-confirmed
  by the handler); (c) enable the SES account-level suppression list;
  (d) set `SNS_TOPIC_ARN=<topic-arn>` in `/opt/ca-app/backend/.env` and
  `pm2 restart ca-api`; (e) fill `[YOUR_CONFIG_SET]` + `[YOUR_SNS_TOPIC_ARN]`
  in `aws_response_resubmit.txt` and submit it from the original support
  case. End-to-end verification: after a real permanent bounce/complaint,
  check `pm2 logs ca-api` for `Suppressed <email> after bounce: Permanent`
  and `email.suppressed` in `audit_logs`.
- Browser-push live delivery test once a real device subscribes (Profile page).
- Android: sideload v1.0.1 debug APK (built, android-wrapper/app/build/outputs/apk/debug/)
  to verify shell against app.snbajaj.com; later Play release ($25 dev account) with
  signed AAB; then raise `APP_ANDROID_MIN_VERSION` on each release.
- Consider revoking `AmazonEC2FullAccess` from `ca-backend` IAM user now that infra is
  provisioned (S3+SES suffice for runtime).
- **Security audit DONE (Aug 25 2026, §7b)** — trust proxy / CORS / OTP hashing /
  upload allowlist fixes deployed; secrets scan clean; S3 MPU lifecycle rules added.
- **Cost now (post-migration, Sep 14 2026)**: single Lightsail `micro_3_1` ≈ **$7/mo
  all-in** (compute + free static IP + ~1 TB egress). EC2 t3.micro terminated; no public-
  IPv4 charge; S3 ≈ pennies. Old orphaned eu-north-1 instance + volume terminated Aug 25
  2026. CloudWatch billing alarm at $2/mo threshold; SNS topic `aws-billing-alerts` →
  anirudhlohiya999@gmail.com. (Worth double-checking support to Amazon that no EC2/EIP
  line items remain after the termination.)
- **Rent-agreement PDF preview fixed (Sep 14 2026, commit f51a623)**: PDF tab was blank
  in production. Cause: Angular sanitizer throws NG0904 for a raw `blob:` URL bound to
  `<iframe [src]>` (resource-URL context); wrap object URLs in
  `DomSanitizer.bypassSecurityTrustResourceUrl()` (see `previewPdfSafeUrl` computed in
  `rent-agreements-create.ts`). Also fixed preview-modal wheel scrolling: panes now have
  `min-height: 0` and the PDF pane is `overflow-y-auto`, so flex children stay bounded
  and scroll instead of the modal clipping (workaround was keyboard-only scrolling).
  Backend preview-pdf endpoint already verified working (HTTP 201, valid PDF).
- **Backend `npm audit` (seen in every CI deploy)**: 13 vulnerabilities reported
  (1 moderate, 12 high) in backend deps — review `npm audit` in `backend/` and bump
  vulnerable transitive deps when convenient. Frontend (admin/client) builds green.
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
