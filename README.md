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
  ├── 06-implementation-plan.md # Step-by-step build sequence
  ├── 07-aws-reference.md    #   AWS + push setup, reusable per client
  ├── 08-project-handbook.md #   Complete context: what we build, what's done, how to run
  ├── 09-run-and-test-guide.md # Beginner-friendly local run & test walkthrough
  └── 10-phase5-deploy-runbook.md # Production deploy runbook + security checklist
design-references/          # Approved UI mockups (client + admin)
backend/                    # NestJS API (Phase 1)
admin/                      # Angular admin dashboard (Phase 2)
client/                     # Angular client PWA (Phase 3)
deploy/                     # Phase 5 deployment kit (bootstrap, nginx, PM2, backups)
android-wrapper/            # Kotlin WebView shell (Phase 4)
```

## Stack

- **Backend:** Node.js 22 + NestJS (TypeScript) · PostgreSQL 16 (self-hosted on EC2) · TypeORM
- **Admin web:** Angular 20 + Tailwind CSS
- **Client app:** Angular PWA (installable, mobile-first) + thin Android wrapper
- **Cloud (AWS):** S3 (private, signed URLs) · SES (email) · FCM (push) · single EC2 t3.micro · Nginx · Let's Encrypt

## Getting started

> **New here?** Follow **`docs/09-run-and-test-guide.md`** — a step-by-step walkthrough for
> running all three apps locally (Docker or native PostgreSQL), wiring AWS, manual
> end-to-end testing, automated tests, and troubleshooting.

1. Read `docs/06-implementation-plan.md` (build sequence) and `docs/02-trd.md` (requirements/env).
2. Complete the one-time AWS setup in `docs/07-aws-reference.md` (IAM keys, S3 buckets, SES, web-push/VAPID, EC2).
3. Fill `backend/.env` from `backend/.env.example`.
4. Each app folder contains its own setup — see per-app READMEs (added during build).

## Status

- Phase 0 (foundations + docs) — **done**
- Phase 1 (backend) — **code complete**, live-tested against real S3/SES; hardened (helmet,
  rate limiting, prod fail-fast config checks, Swagger off in prod)
- Phase 2 (admin web) — **code complete** (in `admin/`); production build config added
  (`environment.prod.ts`, served under `/admin/` in production)
- Phase 3 (client PWA) — **code complete** (in `client/`); production build config added
- Phase 4 (Android wrapper) — not started (decide after live deployment)
- Phase 5 (deploy) — **kit complete in `deploy/`**: EC2 bootstrap script, Nginx reverse
  proxy config, PM2 process file, nightly S3 backup cron, one-command Windows deploy
  script. Runbook with security checklist: `docs/10-phase5-deploy-runbook.md`.
  Actual provisioning (EC2 instance, DNS, TLS) is a manual follow-the-runbook step.