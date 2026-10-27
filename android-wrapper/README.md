# SN Bajaj And Co — Android Client App

Native WebView wrapper around the client portal (`https://app.snbajaj.com`) with a
server-controlled forced-update gate. Package `com.snbajaj.portal`, current release
**1.1.0 (versionCode 3)**, `targetSdk 36` / `compileSdk 36` / `minSdk 24`.

## How the forced update works

- On launch the app calls `GET {API_BASE_URL}/app/version` (public endpoint, no auth).
  Response: `{ min_version, latest_version, store_url }` — controlled via backend env vars
  `APP_ANDROID_MIN_VERSION`, `APP_ANDROID_LATEST_VERSION`, `PLAY_STORE_URL`.
- If `VERSION_NAME < min_version`: browsing still works (app opens normally), but **document
  upload and download are blocked** with a non-dismissable "Update required" dialog that
  deep-links to Google Play.
- If `VERSION_NAME < latest_version` (but >= min): a dismissable "Update available"
  dialog is shown once at startup.

## Build toolchain

- Gradle **8.13** via the checked-in wrapper (`gradlew` / `gradlew.bat`), AGP **8.12.3**,
  Kotlin 2.0.21.
- Run Gradle with **JDK 17–23**. Android Studio's bundled JBR 25 is too new for Gradle 8.13;
  on this machine use `JAVA_HOME="C:\Program Files\Java\jdk-23"`.

```bash
./gradlew assembleDebug        # app/build/outputs/apk/debug/app-debug.apk (sideload)
./gradlew bundleRelease        # app/build/outputs/bundle/release/app-release.aab (Play)
./gradlew lintRelease          # must report 0 errors
```

## Release signing (one-time)

Play needs the AAB signed with an **upload key**. Google then re-signs it with the app
signing key (Play App Signing). Keep the upload key and its passwords safe and backed up;
losing it means a key-reset request to Google.

1. Create the upload keystore (choose your own passwords when prompted):
   ```bash
   keytool -genkeypair -v -keystore snbajaj-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   `keytool` is in `C:\Program Files\Java\jdk-23\bin`.
2. Put `snbajaj-upload.jks` in `android-wrapper/` and create `android-wrapper/keystore.properties`:
   ```properties
   storeFile=snbajaj-upload.jks
   storePassword=...
   keyAlias=upload
   keyPassword=...
   ```
   Both files are gitignored (`*.jks`, `keystore.properties`) — **never commit them**.
3. `./gradlew bundleRelease` now produces a signed `app-release.aab`. Without
   `keystore.properties` the release bundle is built **unsigned** and Play rejects it.

## Play Console checklist (first release)

1. Create the app ($25 one-time developer account), package `com.snbajaj.portal`, enable
   Play App Signing, upload `app-release.aab` to Internal testing first.
2. Store listing: icon `store-assets/play-store-icon-512.png`, feature graphic (1024×500,
   still to make), at least 2 phone screenshots (`../screenshots/`), short + full description.
3. Privacy policy URL: `https://app.snbajaj.com/privacy-policy`.
4. Data safety form: collects name, email, phone, GSTIN/PAN and uploaded financial
   documents for account management; data encrypted in transit; users can request deletion.
5. App access: give reviewers a test login (the seeded test client), since everything is
   behind sign-in.
6. Content rating questionnaire, target audience 18+, no ads.
7. After it is live: raise `APP_ANDROID_MIN_VERSION` / `APP_ANDROID_LATEST_VERSION` in the
   backend `.env` and `pm2 restart ca-api`.

## App Links (portal links open in the app)

The manifest declares an auto-verified App Link for `https://app.snbajaj.com/*` (used by
the WhatsApp "upload documents" magic link). Android only opens these in the app once the
domain proves ownership:

1. Play Console → Setup → App signing → copy the **app signing key SHA-256**.
2. Serve `https://app.snbajaj.com/.well-known/assetlinks.json`:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.snbajaj.portal",
       "sha256_cert_fingerprints": ["<APP SIGNING SHA-256>"]
     }
   }]
   ```
   Until then the links simply keep opening in the browser.

## Every later release

1. Bump `versionCode` (+1) and `versionName` in `app/build.gradle.kts`.
2. `./gradlew bundleRelease lintRelease`, upload the AAB.
3. Once live, raise `APP_ANDROID_MIN_VERSION` if old versions must stop uploading.

## Local testing against dev machine

Edit `APP_URL` / `API_BASE_URL` buildConfigFields in `app/build.gradle.kts`
(emulator: use `http://10.0.2.2:4201` for the client PWA and `http://10.0.2.2:3000/api/v1`;
add `android:usesCleartextTraffic="true"` temporarily for http).

## App notifications (Firebase Cloud Messaging)

WebView has no web push, so the app gets its own notifications through Firebase.
The code is in place but **off until the two Firebase files exist**: without them the
app builds and runs normally and `window.NativePush.available()` returns `false`.

How it works: after a client's first sign-in the app asks for notification permission
(Android 13+), gets the device's FCM token and registers it as `platform: android`
(`POST /me/device-token`). The backend's `NotificationsService.pushToUser()` sends every
alert to all of the client's devices: web push for browsers, FCM for the app. A tap
opens the matching screen. Sign-out removes the phone from the account.

### One-time setup (free, ~10 minutes)
1. Go to <https://console.firebase.google.com> → **Add project** (e.g. "SN Bajaj Portal").
   Google Analytics is not needed.
2. **Add app → Android**: package name `com.snbajaj.portal`, nickname "Client app".
   SHA-1 is not needed for notifications. Download **`google-services.json`** and put it
   at `android-wrapper/app/google-services.json` (git-ignored; never commit it).
3. Server key: **Project settings → Service accounts → Generate new private key**. It
   downloads a JSON file. **Do not paste it anywhere or commit it.**
   - Server: copy it to `/opt/ca-app/secrets/firebase-service-account.json`, then
     `chmod 600` it, add `FIREBASE_SERVICE_ACCOUNT_PATH=/opt/ca-app/secrets/firebase-service-account.json`
     to the backend `.env`, and `pm2 restart ca-api`.
   - Local dev (optional): save it as `backend/secrets/firebase-service-account.json`
     (git-ignored) and point `FIREBASE_SERVICE_ACCOUNT_PATH` at its absolute path.
4. **Cloud Messaging API (V1)** is enabled by default for new projects (Project settings
   → Cloud Messaging). Leave the legacy API off.
5. Build a new release (`versionCode` / `versionName` already bumped to 4 / 1.2.0) and
   upload it.
6. Check: sign in on the app, tap **Turn on**, then send yourself an alert (e.g. reply to
   your own support ticket from the admin panel). If nothing arrives, `pm2 logs ca-api`
   shows `Firebase service account could not be loaded` (wrong path / file) or
   `FCM send failed: …`.

## Known limits

- Notifications in the Android app need the Firebase setup above; until then in-app
  notifications, email and WhatsApp still reach the client.
- Orientation is locked to portrait; Android 16 ignores the lock on large screens
  (tablets/foldables ≥600dp), where the PWA's responsive layout takes over.
