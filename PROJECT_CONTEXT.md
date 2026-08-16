# Project Context — CA Practice Management Platform (Phase 1: GST Module)

> This file is the single source of truth for any AI coding tool (Claude Code, Cursor, Copilot, etc.) working on this project. Treat everything below as fixed project requirements, not suggestions — do not substitute different technologies, patterns, or architecture unless explicitly told to.

## 1. What this project is

A platform for a Chartered Accountant (CA) firm to manage document collection, GST report delivery, and filing reminders for clients, replacing a fully manual process. Two client types exist: **GST users** (150, Phase 1 — this document) and **ITR users** (750, Phase 2 — not yet scoped in detail).

Three components:
1. **Android mobile app** (native, Kotlin) — used by GST users to upload documents and receive reports.
2. **Admin web panel** (Angular, mobile-responsive) — used by the CA (Super Admin) and staff to manage clients, review documents, send reports, and send reminders.
3. **Backend API** (Node.js + NestJS) — serves both clients, talks to the database, S3, SES, and FCM.

## 2. Hard constraint: cost

The client is budget-sensitive and new to cloud software. **Every architecture decision must minimize AWS running cost.** Concretely:
- Use AWS Free Tier services wherever eligible.
- Backend API and database run on a **single EC2 instance** (t3.micro / t2.micro) — do not introduce a separate managed database (RDS) in Phase 1.
- Do not introduce paid third-party services (e.g., no Twilio, no paid push providers, no WhatsApp Business API) in Phase 1.
- Prefer free tools: Amazon SES (email), Firebase Cloud Messaging (push, free), Let's Encrypt (SSL, free).

## 3. User roles

| Role | Where | Access |
|---|---|---|
| **GST User** | Mobile app only | Login, upload documents per filing period, view document status, view/download reports (full history), receive reminders |
| **Super Admin** (the CA) | Admin web panel | Full access: view all clients & documents, upload/send reports, trigger reminders, manage staff accounts & permissions |
| **Staff Admin** | Admin web panel | Limited access, granted per-permission by Super Admin (e.g., view assigned clients, upload reports, send reminders) — cannot manage other staff or global settings unless explicitly granted |

Permissions should be modeled as granular flags per staff account, not fixed roles — this must support future changes without schema rework.

## 4. Functional requirements — Phase 1 (GST)

### 4.1 Authentication
- Email + password login for both mobile app and admin panel.
- Passwords hashed with bcrypt or argon2 — never store plaintext.
- JWT access token + refresh token pattern.
- Future (v1.1, not in initial build): Android BiometricPrompt to unlock a locally stored session — this is a device-side convenience layer only, it does not replace server-side auth.

### 4.2 Document upload (GST user, mobile app)
- User selects a **filing period** (e.g. "July 2026") and uploads one or more files (PDF / image / Excel).
- Files upload **directly to S3** using short-lived pre-signed upload URLs issued by the backend — files must never be proxied through the EC2 server.
- Each document has a status: `pending` → `received` → `processed`.
- S3 bucket is **private**; all reads happen via signed URLs with short expiry, never public URLs.

### 4.3 Admin document review & report delivery
- Admin panel lists clients, filterable by filing period and status.
- Admin can view/download a client's uploaded documents for a period via signed URLs.
- Admin uploads the completed GST report against a specific client + filing period + report type.
- Report becomes visible to that client immediately in their "Reports" section.
- **Full report history is retained** — not just the latest report — tagged by period and type.
- On report upload, automatically trigger: 1) push notification (FCM), 2) email (SES) — both link back into the app. **Never** send the report as a raw email attachment.

### 4.4 GST due-date reminders
- Scheduled job checks upcoming GST due dates daily (configurable number of days before due date) and auto-sends reminders (push + email) to users who haven't filed/uploaded yet for that period.
- Admin can also manually trigger/resend a reminder to one user or a group at any time.
- **Every reminder send (automatic or manual) must be logged**: user, period, channel, status, timestamp, triggered_by (system or admin id). This log must be visible in the admin panel so staff can see who's already been reminded and avoid duplicate sends.

### 4.5 Admin roles & permissions
- Super Admin creates/deactivates staff accounts and assigns granular permissions.
- All admin actions (document access, report uploads, reminders sent) are logged with actor + timestamp for accountability (`audit_logs`).

## 5. Technology stack (fixed — do not substitute)

| Layer | Technology |
|---|---|
| Admin web app | Angular |
| Backend API | Node.js + NestJS (TypeScript) |
| Mobile app | Kotlin, native Android (no cross-platform framework, no iOS in Phase 1) |
| Database | PostgreSQL, **self-hosted on the same EC2 instance** as the API (Phase 1). Migration path to Amazon RDS is a Phase-2-or-later decision, not now. |
| File storage | Amazon S3 (private bucket, signed URLs only) |
| Email notifications | Amazon SES |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Hosting | Single Amazon EC2 instance (t3.micro/t2.micro), Nginx reverse proxy, Let's Encrypt SSL |
| Backups | Nightly cron job: `pg_dump` → upload to a separate S3 bucket/prefix |

## 6. Database schema — outline

```
users
  id, name, email, password_hash, phone, user_type ('gst' | 'itr'),
  status, created_at

admins
  id, name, email, password_hash, role ('super_admin' | 'staff'), created_at

permissions
  id, admin_id (FK -> admins), permission_key, granted (boolean)

documents
  id, user_id (FK -> users), filing_period, s3_key, file_type,
  status ('pending' | 'received' | 'processed'), uploaded_at

reports
  id, user_id (FK -> users), filing_period, report_type, s3_key,
  sent_at, sent_by_admin_id (FK -> admins)

reminders
  id, user_id (FK -> users), filing_period, channel ('push' | 'email'),
  status, sent_at, triggered_by ('system' | admin_id)

gst_filing_periods
  id, period_label, due_date

audit_logs
  id, admin_id (FK -> admins), action, target_user_id, timestamp
```

## 7. API design conventions

- REST, JSON, versioned under `/api/v1/`.
- Auth via `Authorization: Bearer <JWT>` header.
- File upload flow: client calls `POST /api/v1/documents/upload-url` → backend returns a pre-signed S3 PUT URL + document record id → client uploads directly to S3 → client calls `POST /api/v1/documents/:id/confirm` to mark as received.
- File download flow: client/admin calls `GET /api/v1/documents/:id/download-url` → backend returns a short-lived signed GET URL.
- All list endpoints (documents, reports, reminders, users) support pagination and filtering by `filing_period` and `status`.
- Role/permission checks enforced via NestJS guards, not just UI-level hiding.

## 8. Explicit non-goals for Phase 1

- No iOS app.
- No WhatsApp notifications (planned later).
- No managed RDS database (self-hosted Postgres on EC2 only).
- No multi-region / high-availability setup (single EC2 instance is accepted).
- No ITR-specific logic (Phase 2, separate scoping).
- No in-app payments or billing.

## 9. Open items to confirm with the client before/while building

- Exact document file types and expected size/volume per user per month.
- Exact GST due-date rule (fixed day of month vs. varies by filing type) for the reminder scheduler.
- Exact staff permission list needed.
