# 03 — App Flow (every page, every click, every navigation path)

**Project:** CA Practice Management Platform — Phase 1 (GST Module)
**Related docs:** `01-prd.md`, `04-uiux-design-brief.md`, `../design-references/`

This document maps **every screen, every click, and every navigation path** in both applications:

1. **Client Portal** (PWA — "Fiscal Integrity" design, mobile-first, bottom navigation)
2. **Admin Dashboard** (Web — "Fiscal Precision" design, sidebar navigation)

Design mockups live in `../design-references/client-portal/` and `../design-references/admin-dashboard/` (one `code.html` + `screen.png` per screen).

---

## 1. Client Portal — screens & navigation

### Screen inventory

| # | Screen | Route | Mockup folder | Purpose |
|---|---|---|---|---|
| C1 | Login | `/login` | `login/` | Email + password sign-in |
| C2 | Dashboard | `/dashboard` | `dashboard/` | Overview: pending uploads, latest report, recent filing periods |
| C3 | Upload Documents | `/documents/upload` | `upload_documents/` | Pick filing period, upload files |
| C4 | Document Status | `/documents` | `document_status/` | List of uploaded docs + status chips |
| C5 | Filing Reports | `/reports` | `filing_reports/` | Full report history, view/download |
| C6 | Notifications | `/notifications` | `notifications/` | Push/email notice history |
| C7 | Profile | `/profile` | `profile/` | Profile & settings, sign out |

### Global chrome (client app)
- **Top app bar:** hamburger menu (future), app name "GST Portal", notification bell (→ C6), avatar.
- **Bottom navigation** (mobile only, 4 tabs):
  - **Home** (→ C2) · **Documents** (→ C4) · **Reports** (→ C5) · **Profile** (→ C7)
- **FAB** ("+") on Dashboard → jumps straight to **Upload Documents (C3)**.
- Protected routes redirect to **C1** when unauthenticated.

### Navigation graph (client)

```
Start
 ├─ not logged in ────────────────► C1 Login
 │                                    ├─ success ─► C2 Dashboard
 │                                    └─ fail ─► error inline, retry
 └─ logged in (session) ───────────► C2 Dashboard

C2 Dashboard
 ├─ FAB "+" / "Upload Now" btn ───► C3 Upload
 ├─ "View Report" ────────────────► C5 Reports (scroll to latest)
 ├─ filing-period item ───────────► C4 Documents (pre-filtered to period)
 ├─ "View All History" ───────────► C5 Reports
 └─ bottom nav: Documents/Reports/Profile

C3 Upload Documents
 ├─ select filing period (dropdown; defaults to current open period)
 ├─ choose file(s) (PDF/image/Excel) → client-side preflight (type/size)
 ├─ tap "Upload" ──► per file: pre-signed PUT to S3 ─► confirm received
 ├─ success ──► toast + link "View my documents" ─► C4
 └─ error (network/expired URL) ─► retry; on repeated failure, auto-request a fresh URL

C4 Document Status
 ├─ filter chips: All / Pending / Received / Processed
 ├─ period selector
 ├─ item tap ──► document detail (bottom sheet): preview/download via signed URL
 └─ bottom nav: Home/Documents/Reports/Profile

C5 Filing Reports
 ├─ full history, newest first, grouped by filing period + type
 ├─ "Download"/"View" ─► signed GET URL opens the report
 ├─ period filter
 └─ bottom nav

C6 Notifications
 ├─ list of push/email notices (title, snippet, date, unread dot)
 ├─ item tap ──► deep link (e.g. to C5 for "Report ready", C3 for "Upload due")
 └─ mark-all-read action

C7 Profile
 ├─ name/email/GSTIN/phone (read + edit phone)
 ├─ notification preferences (toggle email/push)
 ├─ security: change password
 ├─ "Log out" ──► clears tokens ─► C1
```

---

## 2. Admin Dashboard — screens & navigation

### Screen inventory

| # | Screen | Route | Mockup folder | Purpose |
|---|---|---|---|---|
| A1 | Login | `/login` | `ca_admin_login/` | Admin (CA or staff) sign-in |
| A2 | Overview | `/dashboard` | `ca_admin_dashboard_overview/` | KPI cards + recent activity |
| A3 | Clients List | `/clients` | `ca_admin_clients_list/` | All clients, filterable/paginated |
| A4 | Client Detail | `/clients/:id` | `ca_admin_client_detail/` | One client: docs per period, reports, actions |
| A5 | Send Report | `/clients/:id/send-report` (modal) | `ca_admin_send_report/` | Upload report, triggers FCM + email |
| A6 | Documents | `/documents` | (uses list components) | Cross-client document view (super admin / permission) |
| A7 | Reports | `/reports` | (uses list components) | Cross-client report view |
| A8 | Reminders | `/reminders` | `ca_admin_reminders_management/` | Reminder log + manual trigger |
| A9 | Staff & Permissions | `/staff` | `ca_admin_staff_permissions/` | Staff CRUD + granular permission toggles |
| A10 | Audit Logs | `/audit` | (uses table component) | Read-only action log |
| A11 | Settings | `/settings` | (placeholder) | Periods/due dates, reminder lead days |

### Global chrome (admin app)
- **Top bar:** brand "CA Admin", global search, notifications bell, avatar.
- **Sidebar** (expanded 240px / collapsed 64px / hidden on mobile with hamburger):
  Dashboard · Clients · Documents · Reports · Reminders · Staff · Settings · Audit Logs.
- **"Add New Client"** button in the sidebar → opens Create-Client flow (A3).
- Every route is guarded by permission; unauthorized routes show a 403 state.

### Navigation graph (admin)

```
Start
 └─ not logged in ────────► A1 Login
                              ├─ success ─► A2 Overview
                              └─ fail ─► error inline

A2 Overview
 ├─ KPI card "Total GST Clients" ─► A3 Clients
 ├─ KPI "Pending Documents" ─────► A6 Documents (filter pending)
 ├─ KPI "Reports Sent" ──────────► A7 Reports
 ├─ KPI "Reminders Sent" ────────► A8 Reminders
 ├─ "Recent Activity" row ───────► A4 Client Detail (of that client)
 └─ sidebar: Clients / Documents / Reports / Reminders / Staff / Audit / Settings

A3 Clients List
 ├─ search box (name/GSTIN/phone)
 ├─ filters: filing period, doc status, assigned staff
 ├─ pagination
 ├─ row click ──► A4 Client Detail
 ├─ "Add New Client" ──► create dialog → save → back to A3 (new row)
 └─ row actions: "Send Reminder" (fast action → A8 prefilled)

A4 Client Detail
 ├─ header: client info + key stats
 ├─ tabs: Documents | Reports | Activity
 │    ├─ Documents tab: period selector → doc list → preview/download (signed URL)
 │    │                  → "Mark processed" (permission) → status chip updates
 │    └─ Reports tab: report history → download; "Upload Report" → A5
 ├─ "Send Report" button ──► A5 (modal)
 ├─ "Send Reminder" button ─► A8 (prefilled for this client + period)
 └─ back ─► A3

A5 Send Report (modal on A4)
 ├─ filing period (prefilled), report type (GSTR-1 / GSTR-3B / Reconciliation / Other)
 ├─ attach report file
 ├─ preview step; "Send" ─► POST report
 ├─ success ─► toast: "Report sent — client notified (push + email)"
 └─ cancel ─► back to A4

A6 Documents (cross-client)
 ├─ filters: period, status, client
 ├─ row: client, file name, type, period, status, uploaded date
 ├─ actions: preview/download (signed URL), mark processed
 └─ row click ─► A4 (that client)

A7 Reports (cross-client)
 ├─ filters: period, type, client
 ├─ row: client, period, type, sent date, sent by
 ├─ action: download report
 └─ row click ─► A4

A8 Reminders Management
 ├─ tab "Send Reminder": recipient type (single client / all non-filed for a period),
 │    period selector, channel (push / email / both), "Send"
 ├─ tab "Reminder Log": filters (period, channel, status, triggered_by),
 │    columns: user, period, channel, status, sent_at, triggered_by
 ├─ "Resend" action on a log row
 └─ auto-reminders visible here (triggered_by = system)

A9 Staff & Permissions
 ├─ staff list (active/inactive)
 ├─ "Add Staff" ─► dialog: name, email, password, status
 ├─ staff row ─► permission toggles (view_clients, view_documents, upload_reports,
 │    send_reminders, manage_staff, view_audit_logs, manage_settings)
 ├─ "Deactivate" / "Reactivate" action
 └─ Super Admin row: locked, permissions fixed

A10 Audit Logs
 ├─ filter: admin, action type, date range, target client
 ├─ columns: timestamp, admin, action, target, detail
 └─ read-only

A11 Settings
 ├─ GST filing periods + due dates (CRUD) — feeds the reminder scheduler
 ├─ reminder lead days (e.g. remind 5 days before due date)
 └─ notification defaults
```

---

## 3. End-to-end user journeys

### Journey 1 — Client uploads documents (happy path)
1. Client opens app → **C1 Login** → credentials → **C2 Dashboard**.
2. Taps **"+ / Upload Now"** → **C3 Upload Documents**.
3. Selects filing period **July 2026**, attaches 3 invoices + 1 bank statement.
4. Taps **Upload** → app requests pre-signed PUT URLs → files stream straight to S3 → each confirmed `received`.
5. Success toast → client taps **"View my documents"** → **C4 Document Status** shows 4 items, chip **Received**.
6. Staff later marks files `processed`; chips update. Client sees "Report Ready" when a report arrives.

### Journey 2 — CA reviews & delivers a report
1. Admin opens **A1 Login** → **A2 Overview**.
2. Sees "Pending Documents: 5" → taps KPI → **A6 Documents** filtered to pending.
3. Opens **A4 Client Detail** → Documents tab → downloads 2 files via signed URLs → reviews.
4. Taps **"Upload Report"** → **A5 Send Report** → selects period + type **GSTR-3B**, attaches the PDF → **Send**.
5. Backend stores report in S3, creates history row, fires **FCM push + SES email**.
6. Client's **C2 Dashboard** shows "Latest Report: Report Ready"; **C5 Reports** lists it; notification in **C6**.

### Journey 3 — Automatic due-date reminder
1. Cron fires daily (configurable `REMINDER_CRON`).
2. Finds all clients with no upload for the current period and due date ≤ `REMINDER_LEAD_DAYS` days away.
3. Sends **push + email** per client; each write to the **reminder log** (`triggered_by = system`).
4. Client taps the push → opens **C3 Upload** (deep link).

### Journey 4 — Manual reminder (single or group)
1. Admin → **A8 Reminders** → **Send Reminder** tab.
2. Chooses **single client** or **all non-filed clients for period X** → channel(s) → **Send**.
3. Each send logged (`triggered_by = <admin id>`); log prevents duplicates.

### Journey 5 — Staff with limited permissions
1. Super Admin creates staff in **A9** and grants only `view_clients` + `upload_reports`.
2. That staff logs into admin: sidebar shows only permitted sections; Documents/Reminders/Staff routes → 403.
3. Staff can still review clients and upload reports; actions are recorded in **A10 Audit Logs** under their name.

---

## 4. Notification flows

| Trigger | Channel | Payload / link |
|---|---|---|
| Report uploaded (FR-14) | FCM push + SES email | "Your {Period} {Type} report is ready" → opens C5 |
| Auto reminder before due date (FR-15) | FCM push + SES email | "Documents due for {Period} by {due date}" → opens C3 |
| Manual reminder (FR-16) | push / email / both per selection | same as auto, labeled "reminder from your CA" |

## 5. Error / edge states

- **Login failure:** inline error; lockout after N attempts (rate-limited); "Forgot password" → email reset link.
- **Upload URL expiry:** app detects 403 on PUT → requests a fresh signed URL automatically.
- **Oversized / wrong-type file:** client-side preflight rejects before upload (configurable limits).
- **Empty states:** dashboard without periods, empty document/report lists — friendly "nothing here yet" with a primary action.
- **403 / unauthorized:** route guard redirect or locked screen for both apps.
- **Offline (PWA):** app shell loads from service worker; upload actions deferred with a "queued, will retry" notice.
- **Reminder duplicate guard:** log consulted before sending; manual resend is explicit.

## 6. Permission → screen matrix (admin)

| Permission | Screens allowed |
|---|---|
| `view_clients` | A3, A4 |
| `view_documents` | A4 Documents tab, A6 |
| `upload_reports` | A5 (from A4) |
| `send_reminders` | A8 |
| `manage_staff` | A9 |
| `view_audit_logs` | A10 |
| `manage_settings` | A11 |

Super Admin implicitly has all. Screens without the permission show a 403 state.