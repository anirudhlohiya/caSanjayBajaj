# 01 — Product Requirements Document (PRD)

**Project:** CA Practice Management Platform — Phase 1 (GST Module)
**Client:** CA Sanjay Bajaj & Co.
**Version:** 1.0
**Status:** Approved for build
**Owner:** Anirudh Lohiya (development lead)
**Related docs:** [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) (source of truth), `02-trd.md`, `03-app-flow.md`, `04-uiux-design-brief.md`, `05-backend-schema.md`, `06-implementation-plan.md`

---

## 1. Executive summary

CA Sanjay Bajaj & Co. currently manages document collection, GST report delivery, and filing reminders for clients through a **fully manual process**: documents are collected and reports are shared over email and WhatsApp, reminders are sent ad hoc, and there is no single place to see a client's filing history.

This project replaces that manual process with a small digital platform:

- A **client-facing app** where GST clients upload their monthly documents and receive their completed GST reports.
- An **admin web panel** where the CA and staff manage clients, review documents, upload reports, and send reminders.
- A **backend API** that connects both, stores data securely, and sends notifications (push + email).

The Phase 1 target is **150 GST clients**. A second phase (ITR clients, ~750 users) is planned but out of scope for this build.

---

## 2. Problem statement

- Documents are sent over email/WhatsApp → lost in inboxes, no audit trail, no central record.
- Staff must manually track who has submitted documents and who has not.
- Reports are shared as ad-hoc email attachments with no per-client history.
- Filing deadlines are missed because reminders are not systematic.
- No accountability: it is impossible to see who reminded whom, when, or what was done to a client's file.

## 3. Goals

1. Give clients a single, simple place to upload GST documents and download their reports.
2. Give the CA and staff a single dashboard to see every client, their documents, and their report history.
3. Automate filing reminders before due dates, with full logging of every reminder sent.
4. Make report delivery instant: upload once → client sees it in-app + gets push + email.
5. Keep running costs near zero using AWS Free Tier and free-tier-eligible services.

## 4. Non-goals (Phase 1)

- No iOS app.
- No WhatsApp notifications (planned later).
- No managed database (RDS) — self-hosted PostgreSQL on the EC2 instance only.
- No multi-region / high-availability setup — a single EC2 instance is accepted.
- No ITR-specific logic (Phase 2, separately scoped).
- No in-app payments or billing.
- No cross-platform mobile framework — the client app is an installable PWA in Phase 1, wrapped for Android later.

## 5. Target users & personas

| Persona | Where they use it | What they need |
|---|---|---|
| **GST Client** (~150 users, e.g. "Rajesh") | Mobile-first web app (PWA) | Upload documents per month, check status, download reports, receive reminders. Low technical comfort — the app must be simple. |
| **CA / Super Admin** (Sanjay Bajaj) | Admin web panel | Full access to every client, document, report, reminder, and staff account. Ultimate accountability. |
| **Staff Admin** (accountants/associates) | Admin web panel | Limited access controlled by the CA — e.g. view assigned clients, review documents, upload reports, send reminders. |

## 6. Roles & permissions model

Two account types in the system:

- **Client users** (`users`): belong to the client app. One row per GST client.
- **Admins** (`admins`): belong to the admin panel. Either `super_admin` (the CA) or `staff`.

Permissions are modeled as **granular flags** per staff account (not fixed roles), so access can evolve without schema rework. Baseline permission keys defined in Phase 1:

| Permission key | Meaning | Super Admin default |
|---|---|---|
| `view_clients` | See client list + client details | ✅ (fixed) |
| `view_documents` | View/download client documents | ✅ |
| `upload_reports` | Upload/send GST reports | ✅ |
| `send_reminders` | Manually trigger/resend reminders | ✅ |
| `manage_staff` | Create/deactivate staff, set permissions | ✅ (Super Admin only) |
| `view_audit_logs` | Read the audit trail | ✅ |
| `manage_settings` | Change global settings (e.g. reminder window, periods) | ✅ |

The Super Admin's permissions are fixed and cannot be revoked. Staff permissions default to none and are granted per flag.

## 7. Functional requirements

### 7.1 Authentication
- **FR-1:** Email + password login for both the client app and the admin panel.
- **FR-2:** Passwords hashed with argon2/bcrypt — never stored in plaintext.
- **FR-3:** JWT access token + refresh token pattern for both surfaces.
- **FR-4 (v1.1, deferred):** Android BiometricPrompt to unlock a locally stored session (device-side only; does not replace server auth).

### 7.2 Document upload (client app)
- **FR-5:** Client selects a **filing period** (e.g. "July 2026") and uploads one or more files (PDF / image / Excel).
- **FR-6:** Files upload **directly to S3** via short-lived pre-signed upload URLs issued by the backend. Files are never proxied through the API server.
- **FR-7:** Each document has a status: `pending` → `received` → `processed`.
- **FR-8:** The S3 bucket is private; every read uses a short-lived signed URL. No public URLs ever.

### 7.3 Admin document review & report delivery
- **FR-9:** Admin panel lists clients, filterable by filing period and document status.
- **FR-10:** Admin can view/download a client's documents for a period via signed URLs.
- **FR-11:** Admin uploads the completed GST report against a specific client + filing period + report type.
- **FR-12:** The report becomes visible to that client immediately in their Reports section.
- **FR-13:** Full report history is retained (not just the latest), tagged by period and type.
- **FR-14:** On report upload, automatically trigger: (1) push notification (FCM), (2) email (SES) — both link back into the app. The report is **never** sent as a raw email attachment.

### 7.4 GST due-date reminders
- **FR-15:** A scheduled job runs daily and checks upcoming GST due dates (configurable number of days before the due date), auto-sending reminders (push + email) to users who have not yet uploaded for that period.
- **FR-16:** Admin can manually trigger/resend a reminder to one user or a group at any time.
- **FR-17:** Every reminder send (automatic or manual) is logged: user, period, channel, status, timestamp, triggered_by (system or admin id). The log is visible in the admin panel to avoid duplicate sends.

### 7.5 Admin roles & permissions management
- **FR-18:** Super Admin creates/deactivates staff accounts and assigns granular permissions.
- **FR-19:** All admin actions (document access, report uploads, reminder sends) are logged with actor + timestamp in `audit_logs`.

## 8. Non-functional requirements

| Requirement | Detail |
|---|---|
| **Cost** | Must run on AWS Free Tier. Single EC2 (t3.micro/t2.micro) hosts API + Postgres. No paid third-party services (no Twilio, no paid push, no WhatsApp Business API). |
| **Security** | Private S3 bucket, signed URLs only; bcrypt/argon2 passwords; JWT auth; role/permission checks enforced server-side via NestJS guards; TLS everywhere. |
| **Privacy** | Only the CA, staff, and the specific client can access that client's documents. Files are never publicly accessible. |
| **Performance** | Snappy for 150 clients; list endpoints paginated. Must comfortably handle Phase 2 growth (750+ clients). |
| **Reliability** | Nightly DB backup (`pg_dump` → S3). Appender: simple; a single instance is accepted. |
| **Auditability** | Every meaningful admin action recorded with actor and timestamp. |
| **Accessibility** | Admin and client UI built to be keyboard-navigable and legible (see UI/UX brief). |

## 9. Rollout plan

- **Phase 1 (now):** 150 GST clients — build and launch first.
- **Phase 2 (later):** ~750 ITR clients — added once Phase 1 runs smoothly; separate scoping.

## 10. Success metrics

- % of clients uploading documents through the app instead of email/WhatsApp.
- % of reports delivered on time vs. before.
- Reminder compliance: fewer missed filing deadlines.
- Support/back-and-forth reduction for the firm's staff.

## 11. Security & compliance posture

- Data in transit encrypted (TLS via Let's Encrypt).
- Data at rest in S3 encrypted (SSE-S3 default).
- Access scoped per client record server-side.
- Staff access revocable instantly by the Super Admin.
- Audit trail supports accountability and dispute resolution.

## 12. Assumptions & open items (to confirm with client)

These items do not block Phase 1 but should be confirmed soon (from PROJECT_CONTEXT §9):

1. Exact document file types and expected size/volume per user per month.
2. Exact GST due-date rule (fixed day of month vs. varies by filing type) for the reminder scheduler. Until confirmed, due dates are stored per filing period in `gst_filing_periods` and editable.
3. Exact staff permission list — starting from the baseline set in §6.

## 13. Version history

| Version | Date | Change |
|---|---|---|
| 1.0 | Aug 2026 | Initial PRD from PROJECT_CONTEXT.md + Client_Summary.pdf; PWA decision for client app; granular-permission model; baseline permission set. |