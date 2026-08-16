# CA Practice Management Platform — Phase 1 (GST Module)

A platform for **CA Sanjay Bajaj & Co.** to manage document collection, GST report delivery, and filing reminders for clients — replacing the manual email/WhatsApp process.

## What's in this repo

```
docs/                       # Full project documentation set (start here)
  ├── 01-prd.md             #   Product Requirements — what & for whom
  ├── 02-trd.md             #   Technical Requirements — tools & APIs
  ├── 03-app-flow.md        #   App Flow — every screen, click, path
  ├── 04-uiux-design-brief.md  # UI/UX Design Brief — look & feel
  ├── 05-backend-schema.md  #   Backend Schema — tables, auth, relations
  └── 06-implementation-plan.md # Step-by-step build sequence
design-references/          # Approved UI mockups (client + admin)
backend/                    # NestJS API (Phase 1)
admin-web/                  # Angular admin dashboard (Phase 2)
client-web/                 # Angular client PWA (Phase 3)
android-wrapper/            # Kotlin WebView shell (Phase 4)
```

## Stack

- **Backend:** Node.js 22 + NestJS (TypeScript) · PostgreSQL 16 (self-hosted on EC2) · TypeORM
- **Admin web:** Angular 20 + Tailwind CSS
- **Client app:** Angular PWA (installable, mobile-first) + thin Android wrapper
- **Cloud (AWS):** S3 (private, signed URLs) · SES (email) · FCM (push) · single EC2 t3.micro · Nginx · Let's Encrypt

## Getting started

1. Read `docs/06-implementation-plan.md` (build sequence) and `docs/02-trd.md` (requirements/env).
2. Complete the one-time AWS setup in `docs/02-trd.md` §2 (IAM keys, S3 buckets, SES, Firebase, EC2).
3. Fill `backend/.env` from `backend/.env.example`.
4. Each app folder contains its own setup — see per-app READMEs (added during build).

## Status

- Phase 0 (foundations + docs) — **done**
- Phase 1 (backend) — **code complete**, awaiting AWS credentials to run against real services
- Phase 2 (admin web) — not started
- Phase 3 (client PWA) — not started
- Phase 4 (Android wrapper) — not started
- Phase 5 (deploy) — not started