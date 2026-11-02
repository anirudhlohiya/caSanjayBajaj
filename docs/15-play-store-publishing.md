# Play Store publishing — step-by-step (handoff, Nov 2026)

Status when written (2 Nov 2026): Android app `com.snbajaj.portal` v1.2.0 (versionCode 4),
targetSdk 36, code is Play-ready. The user has a Google Play developer account and is
logged in. Nothing has been uploaded yet. Missing locally: `android-wrapper/keystore.properties`
+ upload key `.jks`, and `android-wrapper/app/google-services.json` (Firebase).
Build/signing details: `android-wrapper/README.md`.

Legend: **(You)** = console/account step only the user can do · **(Code)** = Claude does it in the repo.

---

## Step 0 — Check the account type (You, 1 min)
Play Console → **Settings → Developer account → Account details**.
- **Personal account created after 13 Nov 2023** → before going public Google requires a
  **closed test with at least 12 testers opted in for 14 continuous days**. Plan for this
  (Step 9). Collect 12+ Gmail addresses now (staff, family, friendly clients).
- **Organization account** → no 12-tester rule; go straight to Production after review.

## Step 1 — Firebase for app notifications (You, ~10 min, optional but recommended)
Follow `android-wrapper/README.md` → "App notifications" → steps 1–4:
1. Create the Firebase project, add Android app `com.snbajaj.portal`.
2. Put `google-services.json` at `android-wrapper/app/google-services.json` (never commit).
3. Service-account key → server `/opt/ca-app/secrets/firebase-service-account.json`
   (`chmod 600`), add `FIREBASE_SERVICE_ACCOUNT_PATH=...` to `/opt/ca-app/backend/.env`,
   `pm2 restart ca-api`.
Skip it and the app still works (in-app, email and WhatsApp alerts); you can add it in a
later release, but Data safety then changes.

## Step 2 — Create the upload key (You, 5 min)
```
& "C:\Program Files\Java\jdk-23\bin\keytool.exe" -genkeypair -v -keystore "F:\Anirudh\sanjay project\android-wrapper\snbajaj-upload.jks" -alias upload -keyalg RSA -keysize 2048 -validity 10000
```
Choose a strong password. Then create `android-wrapper/keystore.properties`:
```
storeFile=snbajaj-upload.jks
storePassword=<your password>
keyAlias=upload
keyPassword=<your password>
```
**Back up the `.jks` and the password** (e.g. password manager + Google Drive). Both files
are gitignored. Never paste the password into chat.

## Step 3 — Build the signed bundle (Code or You, 3 min)
```
cd android-wrapper
set JAVA_HOME=C:\Program Files\Java\jdk-23
gradlew.bat bundleRelease lintRelease
```
Output: `android-wrapper/app/build/outputs/bundle/release/app-release.aab`.
(Use JDK 23 — Android Studio's bundled Java 25 is too new for Gradle 8.13.)

## Step 4 — Code fixes Play needs before review (Code — do these first in the new chat)
1. **Privacy policy** (`client/src/app/features/legal/privacy-policy.ts` and
   `website/src/pages/privacy-policy.astro`): add Microsoft Clarity (analytics/session
   recording), Google Firebase (app notifications), Groq (AI that reads/answers WhatsApp
   messages), Meta WhatsApp, Cloudflare R2 (WhatsApp media), AWS (storage/email), and the
   account-deletion process + 30-day grace period. Must match the Data safety form.
2. **Public account-deletion page** (Play requires a web URL usable without the app),
   e.g. `https://snbajaj.com/delete-account` on the Astro site: how to delete in the app
   (Profile → Delete account), what is deleted / kept and for how long, and an email
   contact for people who can't sign in.
3. **Decide on Microsoft Clarity**: remove it from `client/src/index.html`, or keep it and
   mask sensitive data (`data-clarity-mask` on GSTIN/PAN/amount/document areas) — and
   declare it in Data safety.
4. Optional, reduces "WebView wrapper" rejection risk: native "No internet" screen with a
   Retry button in `MainActivity` instead of the WebView error page.
Commit + push (deploys app./snbajaj.com) only after the user's OK.

## Step 5 — Create the app in Play Console (You, 5 min)
**Home → Create app**: name "SN Bajaj And Co", default language English (India), App,
Free, accept declarations. Package name is fixed on first upload (`com.snbajaj.portal`).

## Step 6 — App content (You, ~30 min) — Play Console → Policy → App content
| Item | What to enter |
|---|---|
| Privacy policy | `https://app.snbajaj.com/privacy-policy` (after Step 4.1 is live) |
| App access | "All or some functionality is restricted" → add a reviewer login (the seeded test client `client.test@snbajaj.com` + its password; make sure it is a GST + ITR client with some data) |
| Ads | No ads |
| Content rating | Questionnaire → Utility/Productivity; answer No to violence etc. → likely "Everyone/3+" |
| Target audience | 18 and over only |
| News app | No |
| Data safety | See Step 7 |
| Government app | No |
| Financial features | Declare: app does **not** offer loans, payments, banking or crypto; it is a tax/accounting service portal (if asked: "Other — tax filing assistance") |
| Health | No |
| Account deletion | "Users can request deletion" → in-app path + the URL from Step 4.2 |

## Step 7 — Data safety form (You; Claude can draft exact answers)
- Collects data: **Yes**. Encrypted in transit: **Yes**. Users can request deletion: **Yes**.
- Personal info: Name, Email, Phone, Other (DOB) — account management, app functionality.
- Financial info: "Other financial info" (GSTIN, PAN, tax amounts) — app functionality.
- Files and docs: uploaded bills/returns — app functionality.
- Photos: only if users upload photos — app functionality.
- App activity / interactions: only if Clarity stays — analytics.
- Device or other IDs: FCM token (if Firebase is set up) — app functionality.
- Shared with third parties: none for advertising. Service providers (AWS, Meta WhatsApp,
  Groq, Firebase, Clarity) process data on your behalf — Play treats service providers as
  "not shared", but list them in the privacy policy.

## Step 8 — Store listing (You, ~30 min) — Grow → Store presence → Main store listing
- App name: SN Bajaj And Co · Short description (≤80 chars), e.g. "Upload GST & ITR documents, track filings and get reminders from your CA."
- Full description: what clients can do (upload documents per month, see filing status,
  download returns/certificates, reminders, support tickets, notifications).
  Mention the native features (notifications, downloads, file upload, links open in app).
- App icon: `android-wrapper/store-assets/play-store-icon-512.png`
- Feature graphic 1024×500 PNG/JPG (still to make — Claude can make one)
- Phone screenshots: 2–8 (use `screenshots/` or capture from the app; 9:16, ≥1080 px)
- Category: Business (or Finance) · Contact email: the firm's email · Website: https://snbajaj.com

## Step 9 — Upload and test
- **Personal account (12-tester rule):** Testing → **Closed testing** → create track →
  upload `app-release.aab` → add the 12+ testers' emails → send them the opt-in link →
  they install and keep it for **14 days** → then **Apply for production** (Dashboard).
- **Organization account:** Testing → **Internal testing** first (quick check on your own
  phone), then **Production → Create release** → upload the same AAB → roll out.
- Play App Signing: accept the default (Google manages the app signing key).
- Review usually takes 1–7 days for a new app.

## Step 10 — After the first upload (You + Code)
1. Play Console → Test and release → **App integrity → App signing** → copy the
   **SHA-256 of the app signing key**. Give it to Claude → it publishes
   `https://app.snbajaj.com/.well-known/assetlinks.json` so WhatsApp/portal links open in the app.
2. When live: backend `.env` → `APP_ANDROID_LATEST_VERSION=1.2.0` (and later raise
   `APP_ANDROID_MIN_VERSION` when old versions must stop uploading) → `pm2 restart ca-api`.
3. Every later release: bump `versionCode` (+1) and `versionName` in
   `android-wrapper/app/build.gradle.kts`, rebuild, upload.

---

## Other open items from the 27 Oct–2 Nov review (not Play blockers)
Security (Code): restrict `?token=` login to the WhatsApp SSE stream only
(`backend/src/common/guards/jwt-auth.guard.ts`); replace the 7-day full-access WhatsApp
upload link with a short single-use upload token (`whatsapp-webhook.controller.ts`);
fail startup in production without `WHATSAPP_APP_SECRET` and without `CORS_ORIGIN`;
add a Content-Security-Policy in `deploy/nginx-ca-platform.conf`; size-limited S3 uploads
(presigned POST); admin 2FA; move `xlsx` to devDependencies + update `image-size`;
refresh-token reuse should revoke the session.
Reliability: make `.github/workflows/deploy.yml` wait for CI; `pg_dump` before
`migration:run` in `deploy/release-on-server.sh`; free uptime monitor on `/api/v1/health`;
monthly backup restore test + S3 versioning; 1–2 GB swap; check certbot renewal before 13 Dec 2026.
Server `.env` still to set: `WHATSAPP_APP_SECRET`, `WHATSAPP_TEMPLATES_ACCOUNT_ID=3629482393869045`.
WhatsApp templates `gst_return_filed`, `gst_payment_reminder`, `gst_documents_reminder`,
`gst_filing_input_required` were pending Meta approval.
