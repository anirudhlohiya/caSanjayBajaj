# 07 — AWS & Push Reference (reusable for every client)

**Purpose:** A single record of every cloud resource this platform uses, where its
credentials live, and how to recreate the whole thing for a *new* CA client from a
fresh AWS account. Use it for provisioning, onboarding, and future audits.

---

## 1. Account & region

| Item | Value | Where to find it |
|---|---|---|
| AWS Account ID | `123456789012` | AWS console top-right under your username |
| Region | **ap-south-1** (Asia Pacific, Mumbai) | console top-right region picker |
| Billing model | Free Tier t3.micro/t2.micro, 2 S3 buckets, SES (free 62k msgs/mo), VAPID self-hosted push (₹0) | Cost Explorer |

> All resources below are created in `ap-south-1` unless noted. S3 bucket names are
> globally unique — for a new client, suffix them (e.g. `firm-b-gst-docs`).

---

## 2. IAM user `ca-backend`

The only credential pair the backend uses to talk to AWS. **Never use root keys.**

| Item | Value | Where to find it |
|---|---|---|
| IAM user name | `ca-backend` | IAM → Users |
| Policies attached | `AmazonS3FullAccess`, `AmazonSESFullAccess`, `AmazonSNSFullAccess` | IAM → Users → ca-backend → Permissions |
| Access Key ID | `<AKIA...>` | IAM → ca-backend → Security credentials → Access keys |
| Secret Access Key | `<shown once at creation>` | stored in `backend/.env` |

### How to recreate for a new client
1. IAM → Users → **Create user** → name `ca-backend` → **UNCHECK** console access.
2. Attach policies directly: S3 + SES + SNS full access.
3. **Security credentials** → **Create access key** → *Third-party service* → copy **Access key ID** + **Secret**.

> Secrets policy: rotate the keys annually; store the secret in the client's `backend/.env`
> only (gitignored) — never in the repo, screenshots, or chat logs.

---

## 3. S3 buckets (2 per client)

Private (Block all public access = ON). Used only via pre-signed URLs.

| Bucket | Purpose | Cost |
|---|---|---|
| `ca-sanjay-gst-docs` | Client documents + generated reports | ~$0.023/GB/mo |
| `ca-sanjay-backups` | Nightly `pg_dump` of Postgres | ~$0.023/GB/mo |

### How to recreate for a new client
1. S3 → **Create bucket** → name per client (`<client>-gst-docs`, `<client>-backups`).
2. Region `ap-south-1`, **Block all public access: ON** (acknowledge), ACLs disabled, SSE-S3 encryption default.
3. Reference them in `backend/.env` as `S3_DOCS_BUCKET` / `S3_BACKUP_BUCKET`.

---

## 4. SES (email sender)

| Item | Value | Where to find it |
|---|---|---|
| Region | `ap-south-1` | SES console |
| Verified identity | `<firm email>` | SES → Identities → status **Verified** |
| Source in `.env` | `SES_SOURCE_EMAIL` | — |

### How to recreate for a new client
1. SES → **Identities** → **Create identity** → *Email address* (or the firm's domain + DNS TXT).
2. Click the confirmation email link → status **Verified**.
3. **Sandbox mode** applies until you request production access (SES console → *Request production access*). Sandbox still works for smoke tests; it only limits to verified recipients and rate limits.

---

## 5. Web Push — VAPID keys (no Firebase, ₹0)

The backend sends push **directly to the browser's own push service** using the standard
Web Push protocol (`web-push` npm lib) — Chrome/Firefox/Edge all work. **No Firebase
account, project, or billing is needed.** VAPID is just an RSA key pair.

| Item | Value | Where to find it |
|---|---|---|
| VAPID public key | `BPjZdONqlwavjsW0f1ktKJz3...` | `backend/.env` → `FIREBASE_VAPID_PUBLIC_KEY` (also in `client/src/environments/environment.ts`) |
| VAPID private key | `4tF7D1WraKZIEcx...` | `backend/.env` → `FIREBASE_VAPID_PRIVATE_KEY` |
| VAPID subject | `mailto:<firm email>` | `backend/.env` → `FIREBASE_VAPID_SUBJECT` |

### Generate a fresh pair for a new client
```bash
cd backend && npx web-push generate-vapid-keys
```
Put the public key in the client app env (`client/src/environments/environment.ts`) and
both keys in `backend/.env`. The client app can also override at runtime via
`localStorage.setItem('FP_VAPID_KEY', '...')`.

> The `FIREBASE_PROJECT_ID` / `FIREBASE_APP_API_KEY` / `FIREBASE_AUTH_DOMAIN` vars are
> **legacy/unused** — kept only so existing config code doesn't break. Leave them empty.

---

## 6. EC2 (deployment — Phase 5)

| Item | Value | Where to find it |
|---|---|---|
| AMI | Amazon Linux 2023 (free tier) | EC2 → Launch instance |
| Type | `t3.micro` / `t2.micro` | — |
| Security group | SSH 22 (your IP), HTTP 80, HTTPS 443 | EC2 → Security Groups |
| Key pair | `<client>.pem` (download once, keep safe) | EC2 → Key pairs |
| Public IPv4 / DNS | assigned on launch | EC2 → Instances |
| Roles | Nginx reverse proxy, PM2 (NestJS), Postgres 16, Let's Encrypt | deploy runbook (Phase 5) |

---

## 7. Cost summary (per client, monthly, Free-Tier-optimized)

| Item | Approx. cost |
|---|---|
| EC2 t3.micro (Free Tier, 750 h/mo) | ₹0 until tier runs out |
| S3 2 buckets (docs + backups, small usage) | pennies |
| SES (62,000 emails/mo free) | ₹0 at this scale |
| Web Push VAPID (self-hosted) | ₹0 |
| **Total realistic** | **≈ ₹0–100/month** at launch scale |

> Firebase was deliberately **dropped** to keep cost at zero and avoid a second account.
> Revisit only if we later ship a native Android app that needs FCM (Phase 4 decision).

---

## 8. Where everything lives in the repo

| Credential | File | Gitignored? |
|---|---|---|
| AWS keys, DB, JWT, SES, VAPID, super-admin | `backend/.env` | ✅ (root `.gitignore`) |
| VAPID **public** key (client app) | `client/src/environments/environment.ts` | ❌ (safe — public by design) |
| Template (no secrets) | `backend/.env.example` | ❌ (committed, safe) |

> **Rule:** never commit a `.env` file, a screenshot, or a paste containing an AWS secret
> or the VAPID **private** key. The VAPID public key and `firebaseConfig` values are public.