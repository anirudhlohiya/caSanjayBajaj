# Interview Explanation: CA Sanjay Bajaj Platform

Prepared Sep 14 2026. Accompanying written version of the walkthrough conversation;
everything here reflects the code and the production infrastructure as it runs today.

---

## 1. What is this project?

A full-stack practice-management and document-generation platform for a Chartered
Accountant practice ("CA Sanjay Bajaj"). It has three public faces:

| Face | URL | Stack |
| --- | --- | --- |
| Public marketing/client site | `snbajaj.com` | Angular 20 SPA on Cloudflare Pages |
| Admin portal | `admin.snbajaj.com` | Angular 20 SPA (Vercel design-language styling) |
| REST API | `api.snbajaj.com` | NestJS 11 + PostgreSQL 16, served by nginx |

Features: clients & documents with secure signed-URL uploads, income tax/tax
planning appointments, reminders, reports, a staff module, a website admin, a
ticketing module, audit logging, and (the flagship) rent-agreement templates
that take structured form data and produce formatted `.docx` documents with a
live WYSIWYG edit-and-PDF-preview flow.

Auth is JWT (HTTP-only refresh cookie + in-memory access token). File storage is
S3; database is PostgreSQL on the same host; the document engine is
LibreOffice, driven headlessly by the backend.

---

## 2. The rent-agreement flagship feature

The standout feature, and the most technically interesting one:

1. Admin picks a **template** (e.g. "Tower – Rent Agreement"). Templates are
   `.docx` files shipped in `backend/docs/templates/` plus a JSON config
   describing dynamic fields (party names, premises, rent amounts, dates,
   schedules, etc.), grouped into sections.
2. The backend converts the template to **HTML with a styled editable
   contenteditable surface** and to a **faithful PDF** using headless
   LibreOffice:
   - `POST /admin/rent-agreements/preview` → clean HTML for the Edit tab.
   - `POST /admin/rent-agreements/preview-pdf` → a real PDF via
     `soffice --headless --convert-to pdf`.
3. The admin edits the document content on the left while a live PDF preview
   renders on the right; edits apply to the downloaded `.docx`, while the saved
   form data is kept unchanged (the `.docx` embeds the merged field values).
4. "Generate & Download DOCX" merges the (possibly edited) document and streams
   the `.docx`; "Edit in Word" opens a browser-based editor.

Interview-worthy details:

- **Why blob URLs need `bypassSecurityTrustResourceUrl` in Angular.** Binding a
  blob object URL to `<iframe [src]>` is a *resource URL* security context.
  Angular's `DomSanitizer` throws NG0904 for a raw string there, so the iframe
  silently stays blank. The fix wraps the URL in
  `DomSanitizer.bypassSecurityTrustResourceUrl(...)` — a real bug we hit and
  shipped a fix for (see deployment section).
- **Flexbox scroll trap in a modal.** A CSS grid/flex modal whose panes have no
  `min-height: 0` can never shrink below content height, so the modal clips
  instead of scrolling, and mouse-wheel scrolling silently stops working while
  keyboard still works. Adding `min-height: 0` to the panes fixes wheel
  scrolling — a classic, non-obvious CSS layout bug.
- **HEAD request size.** LibreOffice runs inside the Node process via
  exec/spawn, honors a timeout env var, and returns 503 if disabled — so the
  preview degrades gracefully to "PDF preview unavailable".

---

## 3. The production migration (the meaty part)

The app originally ran on a larger EC2 instance. It is now cut over to an
**AWS Lightsail VM at a third the cost** (~$7/mo), and everything was migrated
with zero-secret leaks and a working CI/CD pipeline:

### Infrastructure today (Lightsail `micro_3_1`)

- `3.111.8.176`, Ubuntu, static IP.
- All three subdomains point at this one box through nginx (`ca-platform.conf`):
  - `api.snbajaj.com` → `http://127.0.0.1:3000` (PM2 `ca-api`)
  - `admin.snbajaj.com/admin/` → static admin build with SPA fallback
  - `app.snbajaj.com` → static client build
- TLS via Cloudflare-origin self-managed certs (Let's Encrypt + DNS-01
  Cloudflare-Powered DNS hook), HTTP→HTTPS 301, HSTS. Renewal is automated;
  nginx uses the modern `listen 443 ssl; http2 on;` form (the deprecated
  `http2` directive triggers config warnings on newer nginx).
- PostgreSQL 16 installed directly on the VM; nightly `pg_dump` → gzip →
  `s3://ca-sanjay-backups` via a cron running `/opt/ca-app/bin/backup.sh`.
- Repo lives at `/opt/ca-app/repo`; `/opt/ca-app/backend` is a symlink so the
  template-path resolution (`path.resolve(process.cwd(), '..', 'docs', 'templates')`)
  still works regardless of where `npm start` runs.

### Zero-downtime-ish cutover steps

1. Built & configured the new OS, installed Node/PostgreSQL/LibreOffice,
   restored the DB from the previous instance's backup.
2. Set up nginx virtual hosts for the three subdomains, then
   **provisioned TLS certs while old DNS was still live** (important ordering —
   so the new box already had valid certs before traffic arrived).
3. **Flipped DNS** (`app` / `admin` / `api` A-records → `3.111.8.176`,
   Cloudflare proxy off for the subdomains) after smoke-testing over the IP.
4. Verified HTTPS: 200 responses on all three hosts, `ssl_verify_result=0`,
   and 301 redirects from HTTP on each.
5. Only after green checks on every route, admin login, and the 
   rent-agreement preview, we stopped the old EC2 instance — then
   **terminated it** (removing its cost permanently). On a retirement path we'd
   keep it a week; here, backups + the new box were proven, so termination was
   safe.
6. Backed out the old deployment's DNS host (`lohiyaanirudh.tech`) from env,
   CORS, and API base URLs.

### CI/CD

- GitHub Actions: any push touching `admin/**`, `client/**`, `backend/**`,
  `docs/templates/**`, `deploy/**`, or the workflow itself triggers a pipeline
  that builds the frontends/backend and runs a deploy playbook, all over their
  deploy SSH key (stored as a repo secret).
- The deploy uses `rsync`/`scp` + `pm2 reload`, then a health check.
  - **A real race we fixed:** the one-shot `curl 127.0.0.1:3000` smoke test ran
    during `pm2 reload` and intermittently failed (connection refused). We made
    the health check a bounded retry loop (20×3 s) so a tick of downtime during
    reload no longer marks the whole run red.
- **Chain-of-trust:** the server never accepts pushes blindly — the
  pipeline verifies the health endpoint over HTTPS at `https://$DEPLOY_HOST/api/v1/health`.

---

## 4. Security decisions & boundaries worth mentioning

- Deploy SSH key is a **repo secret**, never committed; `.env` is `chmod 600`
  on the server and is **not** part of the git repo.
- The old EC2's access key and the decommissioned domain's references were
  scrubbed from env, nginx, CORS allowlists, and the docs.
- Cloudflare API token stays only in a local file (not in the repo).
- Signed S3 URLs for uploads/downloads; passwords stored as bcrypt hashes;
  refresh tokens are HTTP-only cookies; admin routes enforce their own
  401/403 handling verified in testing.
- Know-it-keeps-honest: `npm audit` currently reports ~13 backend
  vulnerabilities (1 moderate, rest high) — open item, not shipped as "done".

---

## 5. Operations / observability

- `pm2 describe ca-api` for process state; `pm2 logs ca-api` for errors.
- nginx access/error logs per subdomain to debug TLS/cert and SPA fallback.
- Backups: verify by `aws s3 ls s3://ca-sanjay-backups/postgres/` — objects are
  timestamped `.sql.gz`; a restore is `gunzip < file | psql`.
- Cost reality (owner's favourite question):

| Scope | Run-rate |
| --- | --- |
| Lightsail `micro_3_1` (+ static IP) | ~$7/mo |
| S3 (backups + uploaded docs) | ~$1–2/mo |
| SES (transactional mail, sandbox) | pennies |
| **6 months** | ~$42–50 |
| **12 months** | ~$84–110 (+ one-time $25 Play-Store fee only if we ever ship the Android app) |

---

## 6. What I'd do next (honest roadmap)

1. Fix the 13 backend `npm audit` items (then set up dependabot).
2. Sprout a staging box so feature branches can deploy *before* main.
3. Add lock/captcha + rate limits on public forms (money, reminder endpoints).
4. Structured logs (JSON) with request IDs, so debugging the API over SSH is
   replaced by a log viewer.
5. DB: introduce `pg_dump` consistency window checks + test a restore in CI.
6. Move secrets to a real secrets manager if the project grows past one box.

---

## 7. Gotchas learnt (Windows-specific) worth a shout in interviews

- PowerShell aliases `curl` to `Invoke-WebRequest` — use `curl.exe` explicitly.
- Committing shell scripts from Windows normally mangles line endings; we write
  `.sh` locally, LF-normalize, scp, and `bash` them on the box.
- `aws` CLI port-listing JSON was fed via `file://...json` to avoid PowerShell
  quoting pain.
- Symlink-aware template paths mean "where does cwd resolve" matters after a
  deploy layout change — resolved early, documented in the runbook.