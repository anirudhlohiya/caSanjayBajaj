# End-to-end test report (10–11 Nov 2026)

> **Fixed 18 Nov 2026 (not yet committed):** C1, C2, C3, C4 / B5 (period = month of
> the data, filed the next month; migration `1800000000010-FilingMonthDueDates`),
> A1 (reply thread), A2 / B1, A3 (dashboard "Waiting for you" card), B2, B4.
> Found while fixing A1: the first staff reply on every ticket was being deleted
> (and a client's follow-up after a reply) — re-saving the ticket with its old
> message list made TypeORM drop the new message. Fixed in `tickets.service.ts`.

Tested locally: client app (375px, 768px, 1366px), admin panel (1024px and 375px), API on
localhost with the Docker database. S3 was live; email and WhatsApp were switched off for the
run. Admin was tested as a full-access staff account, so the super-admin-only Staff page was
not tested. Nothing was fixed.

Severity: **H** = blocks or misleads a real user, **M** = wrong but has a workaround,
**L** = polish.

## Client app

| # | Sev | Where | Problem |
|---|---|---|---|
| C1 | H | Every pop-up sheet (Become a GST / ITR client, Payment options, Delete account, service request) | The page behind scrolls while the sheet is open (moved 500px in the test) and is left at a different place after closing. No sheet locks the background. `profile.html`, `service-detail.html`, `shell.html`. |
| C2 | H | Documents, after a reload or deep link | A GST client lands on "General"; the GST period list holds only "All filing periods" and no tasks show. `documents.ts` `init()` runs in the constructor before the profile has loaded. Works when arriving from another tab. |
| C3 | H | Documents → GST | Opens on the furthest future period (December 2026, now January 2027) and titles it "Current GST period". After an upload, "View my documents" returns to that month, so the upload looks lost. With "All filing periods" chosen the card still shows the old month and "No filing tasks". |
| C4 | H | Due dates everywhere | Tasks for period "October 2026" are due 11 Oct / 20 Oct (`scheduling.service.ts:118`, dates inside the period month). The period itself is due 10 Nov, and the Due Date Calendar and Home say 11 Nov / 20 Nov. Reminders tab shows these overdue tasks under "Upcoming"; the payment reminder says "due on 20 Oct 2026". **Needs a decision: does "October 2026" mean October's sales or returns filed in October?** |
| C5 | M | Home → Your GST Overview | Sales, Purchases, Output GST, ITC and Net Payable are always ₹0 once any report exists; `report.sales` etc. do not exist. Chip "Monthly GST" is fixed text. |
| C6 | M | Home → Next due | Still says GSTR-1 is due after that return was marked filed (it reads the general calendar, not the client's tasks). A brand-new Standard client also sees a GST due date. |
| C7 | M | Language | Hindi / Gujarati translate only the bottom menu and a few Profile headings. Home, Services, Documents, Reminders and page titles stay English. |
| C8 | M | Signup / Forgot password | A wrong OTP returns an error from the API but nothing is shown at the OTP box. |
| C9 | M | Documents → File Nil | One tap declares nil; no confirmation, no undo, and the button sits beside Upload. |
| C10 | M | Notifications | Tapping a notification goes nowhere (no jump to the report, ticket or document). |
| C11 | M | Upload | An unsupported file (.txt) is dropped silently. |
| C12 | M | Documents → Upload on a GSTR-1 / GSTR-3B row | Both open the same period upload; the file always ticks the first pending task, whichever row was tapped. |
| C13 | L | Home | Both "View Dashboard" links open Reports. "Our Services" tiles are 6 fixed slugs while the API has 8 services. |
| C14 | L | Sheets | "Please fix the highlighted fields" stays after the fields are fixed. Background buttons stay focusable. |
| C15 | L | Documents → Request Report Copy | No pending state shown after requesting. |
| C16 | L | Text | Payment reminder shows "₹12,500.5". Login and reset pages say "S N Bajaj & Co"; elsewhere "And Co". Privacy / Terms show "Sign Up / Sign In" while signed in. |
| C17 | L | Security section | Changing the password to the same password is accepted. |
| C18 | L | Tap targets | Due-date chips are 30px high, carousel dots 24px wide, footer links 16px high. Toasts have no `role="status"`. |
| C19 | L | Profile | Pending-request card date wraps to two lines at 375px. While a GST request is pending the ITR card disappears. |
| C20 | — | Desktop / tablet | The app stays a fixed 420px column at 768px and 1366px. Nothing breaks; confirm this is intended for web users. |

## Admin panel

| # | Sev | Where | Problem |
|---|---|---|---|
| A1 | H | Ticket page | Shows only the client's first message, has no reply box and no thread (`ticket-detail.html` renders `messages[0]`). Staff can only close. The client still sees a reply box and "Waiting for reply"; client follow-ups are invisible to staff. |
| A2 | H | Sidebar ticket count | `GET /admin/tickets` without page numbers returns 500 on every page load (see B1), so the open-ticket count never shows. |
| A3 | H | Requests | GST / ITR applications and report-copy requests appear only inside each client's page. No list, badge or dashboard count. |
| A4 | M | Dashboard | "Total GST clients" counts every client. "Upcoming due dates" lists past ones. Clients page is titled "GST Clients" and has no type filter. |
| A5 | M | Client page | Checklist period jumps back to the newest month after every action. A saved payment amount cannot be edited. "Showing 0 to 0 of 0 entries" above real rows. Report type shown as "GSTR_1". |
| A6 | M | Settings → New Period | Code "2027-13" is accepted and pre-fills impossible dates; after correcting the code the old dates stay and the save fails with a long raw message ("Invalid schedule: gstr1.due should be in 2027-02; …"). Edit button is missing on phone. |
| A7 | M | Silent forms | Add FAQ, New blog post (no content), Add family member (empty), New Period (empty): the button does nothing and no message appears. |
| A8 | M | Add New Client | Account type offers only GST or ITR. Phone is not checked for ITR clients. |
| A9 | M | Audit log | Filter lists 4 staff actions only. Creating a client, setting a payment amount and closing a ticket are not logged. Details are raw JSON. |
| A10 | M | Confirmations | Close Ticket, Mark Paid and blog-post Delete act at once. Closed tickets cannot be reopened. |
| A11 | L | Client page at 1024px | Pending request card: GSTIN overflows its box and Reject sticks out. |
| A12 | L | Rent agreement create at 375px | Action buttons overflow by 128px. |
| A13 | L | Misc | Failed-login toast stays after a successful login. "1 days". Amount shown as "₹12500.50". Services cannot be deleted, only hidden. FAQ delete button has no label. Tickets list hides priority. |
| A14 | ? | Reminders page | A reminder went out for October although GSTR-1 was already filed, and on all three channels while the channel boxes read unticked. Check by hand. |

## API

| # | Sev | Problem |
|---|---|---|
| B1 | H | `GET /admin/tickets` → 500 "skip is not a number" when `page` / `pageSize` are missing. `tickets.controller.ts:108` types the query as an intersection, so pagination defaults are not applied. |
| B2 | H | `POST /admin/staff` returns the new account's `password_hash`. |
| B3 | M | `PATCH /compliance-tasks/admin/:id/payment` accepts a negative amount. |
| B4 | M | `POST /periods` with code `2027-13` → 500 instead of 400. |
| B5 | M | New periods created automatically are due inside their own month (January 2027 → 11 Jan); older ones are due the following month. Same root as C4. |
| B6 | L | Forgot-password answers "Email is not registered" (reveals who has an account). |
| B7 | L | Phone accepts any 10–20 characters; GSTIN is only length-checked on the server. |
| B8 | L | Uploaded file keys end in `.pdf.pdf`. |

## Passed

Signup with OTP, login (wrong password, mixed case), forgot password, GST and ITR applications
and approval, checklist generation, upload to S3 and download, mark filed with ARN and PDF,
payment reminder, nil declare and confirm, report-copy request and fulfilment, ticket create
with attachment, the client inbox, profile photo, DOB rule (18+), password change, dark mode,
delete account and cancel by signing in, family member, certificates, ITR return upload,
service create / hide (markdown sanitised), FAQ add, blog draft, staff blocked from the Staff
page. No sideways overflow on any client screen at 375px or on admin pages other than A12.

## Not tested

Super-admin Staff page, WhatsApp desk sending, real email / WhatsApp / push delivery, rent
agreement generation and the Word editor, due-date add / edit, blog publish, the Android app
itself, real phones.
