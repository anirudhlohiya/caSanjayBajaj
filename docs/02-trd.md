# 02 — Technical Requirements Document (TRD)

**Project:** CA Practice Management Platform — Phase 1 (GST Module)
**Related docs:** `01-prd.md`, `03-app-flow.md`, `05-backend-schema.md`, `06-implementation-plan.md`, `../PROJECT_CONTEXT.md`

---

## 1. Technology stack (fixed — do not substitute)

| Layer | Technology | Why |
|---|---|---|
| Backend API | **Node.js 22 + NestJS (TypeScript)** | Structured, modular, enterprise-grade; first-class TypeScript; guards/DI fit the permission model. |
| Admin web app | **Angular** (v20) + Tailwind CSS | Fixed by requirements; Tailwind matches the approved design mockups. |
| Client app | **Angular PWA** (installable, mobile-first) | Approved decision: responsive web app packaged as an installable PWA. Serves the same code to all devices. |
| Android wrapper | **Kotlin, native Android WebView shell** (Phase 4) | Wraps the PWA for Play Store distribution later; registers its own native FCM token. |
| Database | **PostgreSQL 16, self-hosted on the same EC2 instance** | Fixed by requirements. Migration path to RDS is Phase-2-or-later, not now. |
| ORM / migrations | **TypeORM** (with generated migrations) | Native NestJS integration; clear entity → schema mapping. |
| File storage | **Amazon S3** (private bucket, signed URLs only) | Cost-efficient, offloads file traffic from EC2. |
| Email | **Amazon SES** (via SDK) | Free tier, reliable. |
| Push | **Firebase Cloud Messaging (FCM)** — Web Push for PWA + native for the Android wrapper | Free; one provider for both. |
| Hosting | **Single EC2 t3.micro/t2.micro** (Amazon Linux 2023), **Nginx** reverse proxy, **Let's Encrypt** SSL | Free tier; keeps cost minimal. |
| Process manager | **PM2** | Keeps the NestJS API alive on EC2. |
| Backups | Cron job: `pg_dump` → **S3** (separate backup bucket) | Automated, off-instance backups. |
| Scheduling | `@nestjs/schedule` (cron) | Daily due-date reminder job. |

### Development toolchain (local machine)
- Node.js 22.14, npm 10
- Nest CLI, Angular CLI
- Docker (28) — used only if a throwaway local Postgres is needed for quick runs; in Phase 1 the primary database is the EC2 instance.
- Git 2.50, Java 23 (for the Android wrapper), Android Studio (Phase 4)

---

## 2. AWS services & setup requirements

Everything below is consumed via environment variables — nothing is hardcoded.

| Service | What we use it for | Setup required (one-time) |
|---|---|---|
| IAM | Backend credentials to call AWS | User `ca-backend` with **Programmatic access**; policies: `AmazonS3FullAccess`, `AmazonSESFullAccess`, `AmazonSNSFullAccess`. Provides **Access Key ID + Secret Access Key**. |
| S3 | Private file storage + backups | Two private buckets (Block all public access = ON): `ca-sanjay-gst-docs` (documents + reports) and `ca-sanjay-backups` (nightly dumps). |
| SES | Report + reminder emails | Verify an email address (test) and/or the firm's domain (DNS TXT). Starts in **sandbox** (verified recipients only) until production access is granted. |
| FCM | Push notifications | Firebase project; register a **Web app** to get the `firebaseConfig`; generate a **VAPID key** for Web Push. (Native wrapper: server key later.) |
| EC2 | Postgres + API + Nginx | Amazon Linux 2023, t3.micro, key pair, security group: SSH(22), HTTP(80), HTTPS(443). Public IPv4 + `.pem` path provided to ops. |
| SNS | (Optional) bridge for notifications | Only if needed; policy attached to the IAM user for future use. |

> Full click-by-click AWS walkthrough: see `../docs/06-implementation-plan.md` §Cloud setup, and the deployment runbook once written.

---

## 3. API design conventions

- REST + JSON, versioned under `/api/v1/`.
- Auth: `Authorization: Bearer <JWT>` header.
- Two auth surfaces:
  - **Client tokens** → identify `users`.
  - **Admin tokens** → identify `admins` (super_admin or staff).
- **Upload flow (client):**
  1. `POST /api/v1/documents/upload-url` → backend returns a pre-signed S3 **PUT** URL + document record id.
  2. Client uploads the file **directly to S3** (never through the server).
  3. `POST /api/v1/documents/:id/confirm` → marks the document `received`.
- **Download flow:** `GET /api/v1/documents/:id/download-url` (and same for reports) → short-lived signed **GET** URL.
- All list endpoints support **pagination** and **filtering by `filing_period` and `status`**.
- Role/permission checks enforced with **NestJS guards** (server-side), never UI-only.
- Swagger/OpenAPI at `/api/docs` for the API.

## 4. Security architecture

- **Passwords:** argon2 (bcrypt acceptable) — hashed, salted, never stored in plaintext.
- **Sessions:** short-lived JWT access token + rotating refresh token.
- **Authorization:** per-endpoint guards; staff actions gated by granular permission flags (`PermissionsGuard`).
- **Files:** private S3 bucket; pre-signed URLs with short expiry; server only ever returns URLs, never proxied bytes.
- **Secrets:** stored in `.env` (gitignored); `.env.example` documents every variable.
- **Transport:** HTTPS enforced by Nginx + Let's Encrypt.
- **Observability of access:** `audit_logs` records admin actions with actor + timestamp.

## 5. Environment & configuration

`backend/.env.example` will contain (final values provided at deploy):

```
# App
NODE_ENV=
PORT=3000
API_BASE_URL=

# Database (on EC2)
DB_HOST=
DB_PORT=5432
DB_NAME=
DB_USER=
DB_PASSWORD=

# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=30d

# AWS
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_DOCS_BUCKET=
S3_BACKUP_BUCKET=

# SES
SES_SOURCE_EMAIL=
SES_SOURCE_NAME=CA Sanjay Bajaj & Co.

# FCM / Web Push
FIREBASE_PROJECT_ID=
FIREBASE_APP_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_VAPID_KEY=

# Reminders
REMINDER_LEAD_DAYS=5
REMINDER_CRON=0 8 * * *
```

## 6. External integrations summary

| Integration | SDK / method | Direction | Notes |
|---|---|---|---|
| AWS S3 | `@aws-sdk/client-s3` | Backend → S3 | `getSignedUrl` (PUT + GET), server-side encryption. |
| AWS SES | `@aws-sdk/client-sesv2` | Backend → SES | Send email; template + app links; never raw attachments. |
| FCM Web Push | `firebase-admin` / REST with VAPID | Backend → FCM → client browser | Subscriptions saved per user device. |
| FCM native (Phase 4) | Firebase Android SDK | Android shell → FCM → Backend | Token stored; backend pushes to it. |
| PostgreSQL | `pg` via TypeORM | Backend ↔ DB | Pooled; migrations versioned. |

## 7. Repo structure

```
sanjay project/                 (monorepo)
├── docs/                       # this documentation set
├── design-references/          # approved UI mockups + design tokens
├── backend/                    # NestJS API (Phase 1)
├── admin-web/                  # Angular admin panel (Phase 2)
├── client-web/                 # Angular PWA (Phase 3)
└── android-wrapper/            # Kotlin WebView shell (Phase 4)
```

## 8. Testing strategy

- **Backend:** Jest unit tests + supertest e2e tests for auth and the upload/report flows; CI-friendly `npm run lint`, `npm run test`, `npm run build`.
- **Admin/Client web:** Angular component tests for critical screens; manual E2E against real AWS once deployed.
- **Integration:** end-to-end smoke of upload → review → report → reminder on the EC2 instance before sign-off.

## 9. Non-negotiable constraints

1. Stack is fixed (per PROJECT_CONTEXT.md). Do not introduce RDS, Twilio, WhatsApp, or a second instance in Phase 1.
2. Files never proxy through the API server (pre-signed S3 URLs only).
3. No plaintext passwords; no public S3 URLs; no unencrypted traffic.
4. Every reminder send and every privileged admin action is logged.