# SN Bajaj And Co — Android Client App

Native WebView wrapper around the client portal (`https://app.snbajaj.com`) with a
server-controlled forced-update gate.

## How the forced update works

- On launch the app calls `GET {API_BASE_URL}/app/version` (public endpoint, no auth).
  Response: `{ min_version, latest_version, store_url }` — controlled via backend env vars
  `APP_ANDROID_MIN_VERSION`, `APP_ANDROID_LATEST_VERSION`, `PLAY_STORE_URL`.
- If `VERSION_NAME < min_version`: browsing still works (app opens normally), but **document
  upload and download are blocked** with a non-dismissable "Update required" dialog that
  deep-links to Google Play.
- If `VERSION_NAME < latest_version` (but >= min): a dismissable "Update available"
  dialog is shown once at startup.

## Release checklist

1. Bump `versionCode` (+1 every release) and `versionName` in `app/build.gradle.kts`.
2. Build release AAB: `./gradlew bundleRelease`
3. Upload to Play Console; once live, raise `APP_ANDROID_MIN_VERSION` in the backend
   `.env` to the previous `versionName` and restart the API (`pm2 restart ca-api`).

## Local testing against dev machine

Edit `APP_URL` / `API_BASE_URL` buildConfigFields in `app/build.gradle.kts`
(emulator: use `http://10.0.2.2:4201` for the client PWA and `http://10.0.2.2:3000/api/v1`;
add `android:usesCleartextTraffic="true"` temporarily for http).
