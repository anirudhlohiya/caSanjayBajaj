# Plan — GST Filing Automation (Phases 11–13) for "SN Bajaj And Co"

> Single source of truth for the next build phase. Read this fully before writing any
> code. Anything marked **[DECISION]** below is an open item — the user must approve or
> change it before that part is built. Anything marked **[DONE]** is already implemented
> and locked. This plan deliberately contains **no code** — it is the blueprint.

---

## 1. Context & goal

The firm currently chases clients monthly for sales/purchase documents over WhatsApp
and email, files GSTR-1 / GSTR-3B / IFF / GSTR-3B(quarterly) returns, then manually
acknowledges each client. This phase automates that loop:

1. Auto-create the monthly **filing period + compliance tasks** for every active GST
   client (monthly *and* quarterly cadence).
2. Auto-send **day-specific reminders** (different message text per reminder day).
3. Let clients **declare a nil month** (no sales/purchase bills) — notifies admin and
   flags a pending nil filing.
4. Store **per-client lifetime documents** (GST Certificate + Udyam Certificate).
5. **Auto-expire stored files after 30 days** (S3 lifecycle) to keep cost ≈ ₹0 for
   storage, while keeping all DB metadata + dashboard numbers forever.
6. Let a client **request a past filed return** (FY + month), admin re-uploads it, and
   the client gets an **email link that auto-downloads and expires after 30 days**.

Out of scope (explicitly deferred): general-public browsing without login, payments,
WhatsApp integration, ITR document workflows, OnlyOffice deployment.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| Compliance task | One "to-do" row in `compliance_tasks` for a user + period + category (e.g. GSTR-1, GSTR-3B, IFF, GST Payment). |
| Filing period | One calendar month row in `gst_filing_periods` (period_code `2026-10`). |
| Cadence | A GST client files **monthly** or **quarterly**. Stored per user, admin-switchable (applies from the next month). |
| Nil filing | Client declares that a month's data is nil (no sales/purchase bills). Client-initiated, admin-confirmed. |
| Certificate | Lifetime per-client file (GST Cert / Udyam Cert). Never expires in S3. |
| Report | The filed-return file admin uploads (`reports` table, has the 5 dashboard numbers). File self-deletes from S3 after 30 days; row stays. |
| Share link | A tokenized 30-day download URL emailed to the client; clicking it downloads the file directly (no web redirect). |

---

## 3. Locked business rules (approved during planning) **[DECISION: APPROVED]**

### 3.1 Document meaning (important, simplifies the model)

- **GSTR-1 = Sales Bills** (one and the same deliverable from the client).
- **GSTR-3B = Purchase Bills** (one and the same deliverable from the client).
- Therefore the client submits **only two document sets per month**: GSTR-1 (sales
  bills) and GSTR-3B (purchase bills). The existing `sales_bills` / `purchase_bills`
  task categories are **removed/merged** into `gstr_1` and `gstr_3b`.

### 3.2 Deadlines & reminders (defaults, auto-applied each month)

**Monthly filers — every calendar month:**

| Task | Due date | Auto-reminder dates | Nil option |
|---|---|---|---|
| GSTR-1 (sales bills) | 11th | 5th, 7th, 11th (3 different messages) | ✅ (client taps "file nil") |
| GSTR-3B (purchase bills) | 20th | 18th | ✅ |
| GST Payment | 20th | none (client pays manually) | ❌ |
| IFF | — | — | — |

**Quarterly filers:**

| Task | Due date | Auto-reminder dates | Nil option |
|---|---|---|---|
| IFF (monthly) | 13th | 5th, 7th, 11th (3 different messages) | ✅ |
| GSTR-3B (purchase bills) | 22nd of the month after the quarter ends (e.g. Apr–Jun quarter → filed 22 Jul) | 20th of the settling month | ✅ |
| GST Payment | 20th (monthly) | no auto reminder — **admin sends manually** | ❌ |
| GSTR-1 (monthly) | — (replaced by IFF) | — | — |

**Quarter definition** (GST standard): Apr–Jun, Jul–Sep, Oct–Dec, Jan–Mar. The quarterly
GSTR-3B task is generated in the **last month of the quarter** (Jun/Sep/Dec/Mar period),
with `due_date` set to the 22nd of the following month and a quarter label like
"Apr–Jun 2026".

### 3.3 Admin overrides

- Admin can change a client's cadence: monthly ↔ quarterly. **Takes effect from the
  next month**; current month's tasks are untouched.
- Admin can edit a period's **deadline dates AND reminder dates** (per month, in case
  the government extends/changes dates). Editing reminder dates moves the auto-reminders.

### 3.4 Reminders use the user's stored channels

Reuse the existing user push-token + email infra (`NotificationsService.sendEmail` /
`sendPush`) exactly like `RemindersService` does today. Every auto-send is logged in the
existing `reminders` table (`triggered_by = 'system'`) so the admin can audit them.

### 3.5 Nil filing (client-initiated)

- Client taps "File Nil" on an eligible task (GSTR-1 / GSTR-3B / IFF).
- Task status → **`nil_declared`**, `nil_declared_at` set.
- Admin gets (a) an in-app/email notification and (b) a **pending nil-filing queue**
  entry. Admin confirms the nil return → task status → **`completed`**.

### 3.6 Certificate documents

- Admin uploads **GST Certificate** and **Udyam Certificate** per client (lifetime).
- Client sees them in **Profile → "Your Documents"**.
- Non-GST users (ITR) see an empty-state message: "You don't currently have any documents."

### 3.7 30-day S3 auto-delete

- Applies to **all** files under `docs/` (client uploads) and `reports/` (admin uploads).
- Implemented with an **S3 lifecycle expiration rule** (free, no compute).
- DB rows and the 5 dashboard numbers are **kept forever** — only the object is deleted.
- Certificates live under `certificates/` — **excluded** from the expiry rule.

### 3.8 Email share links (30-day expiry, auto-download)

- Every "report ready" and "request fulfilled" email contains a tokenized link:
  `https://api.snbajaj.com/api/v1/public/report/download/<token>`.
- Clicking it **302-redirects to a fresh S3 pre-signed URL** with
  `response-content-disposition: attachment` → file downloads to the client's device.
  (No web-app redirect, no file proxying — respects the architecture rule.)
- Token row stores `expires_at = now + 30 days`; after expiry → friendly "link has
  expired" response. Matches the 30-day S3 deletion.
- S3 pre-signed URLs cap at 7 days; that's why we use a DB token + redirect instead of
  a 30-day pre-signed URL.

### 3.9 Report request (client asks for a past filed return)

- Client selects **financial year + month** in the Documents screen → creates a request.
- Admin (in a queue, e.g. on the client's detail page or a dedicated page) re-uploads
  the return file from their backup → status `fulfilled` → report row created, client
  notified + emailed a 30-day share link.
- The new fulfilled report is a normal `reports` row (gets the 30-day S3 lifecycle too).

---

## 4. Draft reminder copy **[DECISION: APPROVE OR EDIT]**

All messages line up with the current email branding ("S N Bajaj And Co"). Placeholders:
`{month}` = period label, `{dueDate}` = category due date, `{quarter}` = quarter label.

**GSTR-1 (monthly sales bills):**
- **Day 5:** "Dear {name}, a gentle reminder that your {month} sales bills (GSTR-1) are
  due for submission by {dueDate}. Please upload them at your convenience."
- **Day 7:** "Dear {name}, your {month} sales bills (GSTR-1) are still pending. Please
  upload them by {dueDate} so we can file on time."
- **Day 11 (last day):** "Dear {name}, TODAY is the last day to submit your {month} sales
  bills (GSTR-1). Please upload immediately to avoid a late filing."

**GSTR-3B (monthly purchase bills, reminder on 18th):**
- "Dear {name}, a reminder that your {month} purchase bills (GSTR-3B) are due by
  {dueDate}. Please upload the purchase documents so we can file your return on time."

**IFF (quarterly filers, monthly — reminders on 5/7/11):**
- **Day 5:** "Dear {name}, a gentle reminder that your {month} IFF sales summary is due by
  {dueDate}. Please upload it at your convenience."
- **Day 7:** "Dear {name}, your {month} IFF sales summary is still pending. Please upload
  it by {dueDate}."
- **Day 11:** "Dear {name}, your {month} IFF sales summary is due very soon. If your sales
  were nil, please tap 'File Nil' so we can proceed."

**GSTR-3B quarterly (reminder on 20th of settling month):**
- "Dear {name}, a reminder that your {quarter} purchase bills (GSTR-3B) are due by
  {dueDate}. Please upload the purchase documents for the quarter."

**Nil reminder hint** (message text asks nil-eligible clients to use "File Nil").

---

## 5. Full lifecycle walkthrough (how it runs every month/quarter)

### 5.1 Month rollover (server-side cron, runs once daily)

1. **Ensure periods exist**: current month, next month, month+2 are auto-created if
   missing (`gst_filing_periods`), each with the default schedule (rules §3.2). Existing
   periods — including any admin date overrides — are left untouched. (Also supports
   backfill: if the server was down and a month was missed, the *current* month is
   created + tasks generated; past months are not retroactively task-generated unless
   explicitly requested.)
2. **Generate tasks** for every ACTIVE GST user for the current month (idempotent —
   skip any already existing user+period+category):
   - Monthly filer → `gstr_1`, `gstr_3b`, `gst_payment`.
   - Quarterly filer → `iff`, `gst_payment`; and if the current month ends a quarter →
     `gstr_3b` with `due_date` = 22nd of next month + quarter label.
3. **Flip cadence boundary**: if the admin changed a client's cadence, the change simply
   dictates which set is generated from the *next* month onward.

### 5.2 Daily reminder cron (runs once daily, e.g. 08:00)

For each open period whose config has a reminder on **today**:

| Reminder day → | Target users | Scan task | Message set |
|---|---|---|---|
| GSTR-1 reminders (5/7/11) | monthly filers | `gstr_1` for that period | copy §4 |
| IFF reminders (5/7/11) | quarterly filers | `iff` for that period | copy §4 |
| GSTR-3B reminder (18) | monthly filers | `gstr_3b` for that period | copy §4 |
| Quarterly GSTR-3B reminder (20) | quarterly filers | `gstr_3b` for the *quarter-end* period | copy §4 |
| Payment | — | — | no auto-reminder (admin sends manually via existing reminder UI) |

Skip users whose task is `completed`, `uploaded`, or `nil_declared`. Send email + push,
log each send in `reminders` (duplicate guard: one SENT row per user+period+category+day
— the existing "already today" guard plus a "task-day" field makes repeats impossible).

### 5.3 Client experience (Android app / PWA)

1. After login → **Documents** screen:
   - Shows the **current period** card (real data from backend, not hardcoded).
   - Lists the month's tasks from the backend (GSTR-1 sales bills, GSTR-3B purchase
     bills, GST Payment as appropriate for cadence), each with **Progress** =
     completed ÷ total non-payment tasks for the period.
   - Each nil-eligible task shows **Upload** (or "Uploaded") **and File Nil**.
   - Tapping a completed/uploaded task lets the user view/download (while the file
     exists).
2. **Dashboard** keeps the existing GST Overview (last sent report's 5 numbers) — no
   change.
3. **Profile → Your Documents**: shows GST Certificate + Udyam Certificate (lifetime) with
   download; ITR users see the empty state.
4. **Documents → "Request a filed return"**: pick FY + month → request → track status
   (pending → fulfilled with download link). If a previously sent file has expired, this
   is exactly the flow to get a fresh copy.

### 5.4 Admin experience

1. **Clients list**: cadence shown (Monthly/Quarterly); Add Client form gains a **Filing
   Frequency** dropdown (default Monthly). Edit any client's cadence (effective next
   month). Import script reads a `frequency` Excel column.
2. **Client detail page** — existing **Compliance Checklist** becomes cadence-aware:
   - Auto-generated tasks appear (no manual "Generate" needed; the button is removed or
     kept only as a backfill for legacy periods).
   - **Pending nil filing banner/flag** appears when a task is `nil_declared` — admin
     confirms → completed. Admin is notified via email and an admin in-app marker.
   - **Certificates** card: upload/replace GST Certificate + Udyam Certificate per client.
3. **File return upload** (existing `reports` flow): stays — includes the 5 numbers.
4. **Report requests queue**: list of client requests (client name, FY+month), with
   "Fulfill" → upload the return file → auto email share link + notification. Optionally
   also shown inline on the client detail page.
5. **Settings → Filing Periods** (existing screen): each period row gains editable
   **deadline dates + reminder dates** (schedule per month) with sensible defaults
   pre-filled; admin overrides for a specific month are saved on the period row.
6. **Reminders log / manual payment reminders**: existing screens unchanged; payment
   reminders remain manual and are sent through the existing "Send Reminder" UI.

---

## 6. Backend design

### 6.1 Schema / migrations (ordered, one file per change)

| # | Migration | Purpose |
|---|---|---|
| 1 | `AddUserFilingFrequency` | `users.gst_filing_frequency` enum (`monthly`/`quarterly`, default `monthly`). |
| 2 | `AddPeriodSchedule` | `gst_filing_periods.schedule` JSONB (nullable). Default schedule computed at creation. |
| 3 | `ExtendComplianceTask` | Task status enum gains `nil_declared`; add `nil_declared_at timestamptz null`, `message_day int null` (0/1/2 reminder-slot grouping, for dedupe). |
| 4 | `CreateClientCertificates` | `client_certificates` (id, user_id, cert_type enum `gst_cert`/`udyam_cert`, s3_key, original_filename, uploaded_at). Index user_id. |
| 5 | `CreateReportRequests` | `report_requests` (id, user_id, period_id, status enum `pending`/`fulfilled`/`rejected`, fulfilled_report_id uuid null, created_at, fulfilled_at). |
| 6 | `CreateReportShareLinks` | `report_share_links` (id, report_id, token unique, expires_at, created_at). Index token + expires_at. |

### 6.2 Entity changes

- `User`: add `gst_filing_frequency`.
- `GstFilingPeriod`: add `schedule: json` — structure:
  ```jsonc
  {
    "gstr1":     { "due": "2026-10-11", "reminders": ["2026-10-05", "2026-10-07", "2026-10-11"], "day_keys": ["day1", "day2", "day3"] },
    "gstr3b":    { "due": "2026-10-20", "reminders": ["2026-10-18"] },
    "iff":       { "due": "2026-10-13", "reminders": ["2026-10-05", "2026-10-07", "2026-10-11"] },
    "payment":   { "due": "2026-10-20", "reminders": [] },
    "quarterly": { "gstr3b": { "quarter_label": "Apr–Jun 2026", "due": "2026-07-22", "reminders": ["2026-07-20"] } }
  }
  ```
  `day_keys` keeps messages stable when admin moves a date (`day1` = copy slot 1).
- `ComplianceTask`: status enum + `nil_declared_at` + `message_day`.
- `ComplianceCategory`: **remove** `sales_bills`/`purchase_bills`; keep `gstr_1`,
  `gstr_3b`, `iff`, `gst_payment` (existing DB enum migration is additive-only where the
  DB is Postgres enum — see §6.4 note).
- New entities: `ClientCertificate`, `ReportRequest`, `ReportShareLink`.

### 6.3 Modules / services

| Module | Responsibility |
|---|---|
| `SchedulingService` (new, in `compliance-tasks/` or `schedule/`) | Computes default period schedule from rules §3.2; backdates for a month/quarter; validates admin overrides. Pure functions → unit-testable. |
| `PeriodsService` (extend) | Auto-ensure periods (current + lookahead-2) via a daily cron; `schedule` field in create/update DTO (DEFAULT hook: if schedule absent, generate from rules). |
| `ComplianceTasksService` (extend) | `ensureTasksForPeriod(periodId, userId)` idempotent generation per cadence; `markNil(id, user)`; `confirmNil(id, admin)`; statuses. Expose `pendingNilFilings()` for the admin queue. |
| `RemindersService` (rewrite cron) | Replace the generic 08:00 cron with the task/date-driven cron (§5.2). Reuse `sendReminder`/delivery helpers; keep manual-send admin endpoints intact. |
| `CertificatesModule` (new) | Admin upload (presigned URL + confirm), list, download per client. Uploaded files always under `certificates/{userId}/…`. |
| `ReportRequestsModule` (new) | Client create/list; admin list/fulfill (fulfill = upload report + create report row + share link + notify/email). |
| `ShareLinksModule` (new) | Create token (30-day expiry); `GET /api/v1/public/report/download/:token` → validate → 302 to presigned URL with `ResponseContentDisposition=attachment; filename="…"`. Mark "expired" state post-expiry. |
| `ReportsService` (extend) | `confirmAndNotify` email now carries the 30-day share link instead of the in-app URL (keep in-app link too); `downloadUrl` unchanged. |

### 6.4 Migration note — Postgres enum change

`compliance_tasks.category` and `.status` are Postgres enums. Adding enum values
(`nil_declared`) is safe via `ALTER TYPE ... ADD VALUE`. **Removing** values
(`sales_bills`/`purchase_bills`) from a Postgres enum is dangerous — plan to:
- stop generating them (new periods never get them);
- keep the enum values in place (harmless), only retire them in app logic/UI.
Data-migrate or ignore existing legacy task rows (they remain visible as history).

### 6.5 API surface (all guarded unless stated)

| Method | Path | Guard | Notes |
|---|---|---|---|
| POST | `/me/compliance-tasks/:id/nil` | JWT user, owner | client-initiated nil |
| GET | `/admin/compliance-tasks/nil-pending` | admin `view_clients` | pending nil queue |
| PATCH | `/admin/compliance-tasks/:id/nil-confirm` | admin `view_clients` | confirm nil → completed |
| GET | `/admin/clients/:id/certificates` | admin `upload_reports`/`view_clients` | list certs |
| POST | `/admin/clients/:id/certificates/upload-url` | admin `upload_reports` | presigned PUT |
| POST | `/admin/clients/:id/certificates/:certId/confirm` | admin | finalize |
| GET | `/me/certificates` | JWT user | client view (profile) |
| GET | `/me/certificates/:id/download-url` | JWT user owner | lifetime download |
| POST | `/me/report-requests` | JWT user | `{ filing_period_id }` (FY+Month → period) |
| GET | `/me/report-requests` | JWT user | own requests + status |
| GET | `/admin/report-requests` | admin `upload_reports` | queue, filter pending |
| POST | `/admin/report-requests/:id/fulfill` | admin `upload_reports` | upload file → reports row + link + notify + email |
| GET | `/public/report/download/:token` | **none** (token itself is the credential) | 302 → presigned attachment; throttled 10/min |
| GET/PATCH | `/admin/periods/:id` | admin `manage_settings` | edit schedule (deadline + reminder dates) |

No secrets in API responses. Share-link token is unguessable (`crypto.randomBytes(24)`),
stored hashed (sha256) in DB — even a DB leak does not expose live links. Public endpoint
runs behind `ThrottlerGuard` (10/min/IP) and only ever *redirects*, never returns file
bytes through the API server (rules §11).

---

## 7. Client (PWA) changes

- **Documents screen** — replace all hardcoded mock values with backend data:
  - Current period = latest open period (label/date from `gst_filing_periods`).
  - Task list = `ComplianceTasksService.list(periodId)` (already wired).
  - Progress = completed ÷ total non-payment tasks (backend computes sum fields to avoid
    double counting).
  - **File Nil** button per eligible task (`POST /me/compliance-tasks/:id/nil`), with
    inline confirm dialog + success toast.
  - **Request a filed return** form: FY + Month selects → `POST /me/report-requests`;
    below it, list own requests + status + download when fulfilled.
  - "From your CA" section = real recent reports for the selected period.
  - Remove "Run `replace.js`" hack file from repo history/usage.
- **Profile → Your Documents** section: GST cert + Udyam cert with download buttons;
  empty-state for non-GST.
- **Models/services**: add `gst_filing_frequency`, `ClientCertificate`, `ReportRequest`,
  share-link types; extend `ComplianceTasksService` (nil + nil-pending props).
- Keep the GST Overview dashboard exactly as is.

---

## 8. Admin changes

- **Add/Edit Client modal**: `gst_filing_frequency` dropdown (default monthly).
- **Client detail**: cadence badge + edit; cadence-aware checklist (auto-generated);
  pending-nil banner with Confirm action; Certificates card (upload GST Cert + Udyam
  Cert); inline report requests (optional — queue page is primary).
- **New Reports → Request queue** (or under Clients): list + fulfill flow.
- **Settings → Filing Periods**: per-period schedule editor (deadlines + reminder dates)
  with defaults pre-filled; validates dates are in the correct calendar month where
  sensible.
- **Existing report-send modal**: unchanged (already has the 5 numbers).

---

## 9. Import script + Add Client

- Extend `backend/scripts/import-clients.ts` + DTO + admin form enum so the Excel
  accepts a **`frequency`** column (`monthly`/`quarterly`), defaulting to `monthly`.
- Values validate against the enum; invalid rows are reported, not silently dropped.

---

## 10. Infra / S3 / email

1. **S3 lifecycle** on `ca-sanjay-gst-docs`:
   - prefix `docs/` → expire after 30 days.
   - prefix `reports/` → expire after 30 days.
   - prefix `certificates/` → **no expiration**.
   - keep the existing abort-incomplete-multipart-uploads rule.
   - (deliverable: a `deploy/` doc/shell snippet using `aws s3api put-bucket-lifecycle-configuration`.)
2. **Email templates** (`NotificationsService`/`report-notifications`/`reminders`):
   - report-ready & request-fulfilled emails include the share link button.
3. **Env vars** (new, optional): `SHARE_LINK_TTL_DAYS=30` (default 30),
   `AUTO_CREATE_PERIODS_PREFETCH=2`, `TASK_REMINDER_CRON` (default `0 8 * * *`), and
   `NIL_PENDING_ADMIN_NOTIFY_EMAIL` (defaults to the CA account, for nil-filing email
   alerts). All in `.env.example`; none committed.
4. **No new AWS services** — all on the existing free-tier S3/SES/push setup.

---

## 11. Engineering guidelines (non-negotiable during implementation)

1. Fixed stack (§4 of PROJECT_CONTEXT.md) — no new runtimes/services.
2. **FIRST principles**: Fast feedback (unit tests as you go), Isolated (pure schedule
   helpers free of DB/IO), Repeatable, Self-documenting (JSDoc on public methods),
   Timely (small, reviewable commits with `feat(scope): …` messages in repo style).
3. **Never proxy file bytes through the API** — pre-signed S3 and 302-redirects only.
4. **No API leaks**: tokens stored hashed; share-link endpoint throttled; no secrets in
   responses/logs; run `npm audit` clean; don't commit `.env`/keys.
5. Follow existing code conventions (NestJS modules with dedicated DTO/entity/service/
   controller files, Snake_case API DTO fields, `@ApiOperation` summaries, snake_case JSON
   keys, pagination `{items,total,page,pageSize,totalPages}`).
6. TypeORM migrations ONLY (`synchronize: false`). Additive enum changes via
   `ALTER TYPE … ADD VALUE` inside migrations; never drop enum values from existing DB.
7. Every privileged admin action (cert upload, request fulfill, nil confirm, cadence
   change, schedule edit) is written to `audit_logs`.
8. Keep AWS cost ≈ ₹0 extra: one micro machine, S3 lifecycle, no new AWS features.
9. All hardcoded UI values are removed; every number comes from the backend.

---

## 12. Build order / milestones

1. **M1 — Backend foundation**: migrations 1–3 + scheduling service + period auto-create
   cron + task auto-generation per cadence + unit tests. (No API/UI yet.)
2. **M2 — Reminders engine**: rewrite cron with date-driven copy + dedupe + audit logs +
   unit tests. Admin manual payment reminder unchanged.
3. **M3 — Nil filing**: status field, client endpoint, admin pending queue + confirm,
   notification/email to admin + tests.
4. **M4 — Certificates**: entity + admin upload UI + client Profile section + S3 prefix +
   tests.
5. **M5 — Report requests + share links**: entities + endpoints + email links (302
   redirect) + 30-day expiry + tests.
6. **M6 — Frontend rebind**: Documents/Profile screens wired to real endpoints; remove
   mock + `replace.js`; admin cadence dropdown, schedule editor, queue UIs.
7. **M7 — Import + deploy**: script column, S3 lifecycle snippet, `.env.example`,
   full migration run, CI smoke pass, `docs/` + PROJECT_CONTEXT.md update.

Each milestone ends with green builds + `npm test` green + e2e smoke before moving on.

---

## 13. Testing strategy

- **Unit (Jest)**: calendar/schedule default computation for monthly, quarterly, quarter-
  end GSTR-3B, leap Feb; reminder-date matching; task generation idempotency; nil
  transitions + ownership guards; share-link hash/expiry; request fulfill happy + error
  paths; DTO validation. Follow existing `*.spec.ts` pattern.
- **E2E (supertest)**: health smoke (existing `test/app.e2e-spec.ts`) + one full
  flow: login admin → create period → auto-generate tasks → client login → list tasks →
  mark nil → admin confirms → request report → fulfill → share-link download (mocked S3).
- **Frontend**: `ng build` green (admin + client, `--base-href=/admin/` for admin);
  existing Jasmine smoke if present; manual browser E2E against local `ca-pg`.
- **Manual checklist** (after local run per docs/09): month rollover simulation, reminder
  copy delivery (check `reminders` rows), nil flow end-to-end, cert download, report
  request, email link expiry (set TTL env low for test).
- **Deploy verification**: run new migrations on prod DB, CI Actions green, HTTPS smoke,
  browse each new screen on the wifi/live build.

---

## 14. Open decisions **[DECISION — USER MUST APPROVE]**

1. **Reminder copy** — approve or edit §4 drafts (easy to swap text later).
2. **Quarterly GSTR-3B reminder date** — proposed **20th** of the settling month (2 days
   before 22nd). Approve or change.
3. **Legacy task rows** for `sales_bills`/`purchase_bills` — keep visible as history in
   old periods only (proposed), new periods only use `gstr_1`/`gstr_3b`/`iff`/`gst_payment`.
4. **Payment task on the client screen** — shown as informational "due 20th" chip with
   **no** Upload and **no** nil (proposed). Confirm.
5. **Report "FY + Month" → period mapping** — the client picker maps directly to the
   matching `gst_filing_periods` row (existing months). For months with no period row
   (very old) the request still stores period_id = null + free-text `period_label`
   fallback. Propose: null-label fallback accepted. Confirm.
6. **Fulfill a request** — must admin pick the report type (gstr_1 / gstr_3b / other)?
   Proposed default: auto-map `gstr_3b` for purchase-bill requests, else `gstr_1`;
   override dropdown in the fulfill modal. Confirm.
7. **Nil confirm closes the month's payment too?** Proposed: NO — payment stays a
   separate task; nil only covers the document tasks the client marks. Confirm.
8. **Reminder time-of-day** — 08:00 server time (reuses existing cron hour). Confirm.
9. **Should reminders repeat if the task is still pending on the *deadline* itself?**
   The GSTR-1 11th message doubles as the last-day reminder (as drafted). GSTR-3B 18th
   is 2 days early. Confirm no additional same-day deadline reminder is needed beyond
   the drafted dates.
10. **Certificates file types** — restrict to pdf/jpg/png (proposed) for simple
    lifetime viewing. Confirm.

---

## 15. References

- `PROJECT_CONTEXT.md` (base rules, §11 non-negotiables).
- `docs/09-run-and-test-guide.md` (local run/test).
- `docs/11-lightsail-migration-runbook.md` (deploy).
- `backend/src/compliance-tasks/*` (existing tasks scaffold to extend).
- `backend/src/reminders/reminders.service.ts` (cron + delivery to reuse).
- `backend/src/reports/*` (report + 5 numbers + notification hooks).
- `backend/src/storage/storage.service.ts` (S3 helpers).