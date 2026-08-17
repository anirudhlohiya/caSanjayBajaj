# Fiscal Integrity — Client PWA (Phase 3)

Angular 20 Progressive Web App for **CA Sanjay Bajaj & Co.** clients — document upload, status tracking, GST report download, push notifications, and profile management.

## Stack

- Angular 20 (standalone components, lazy routes, signals)
- Angular Service Worker (`@angular/pwa`) for offline support + web push
- Tailwind CSS v4 (via `@tailwindcss/postcss`, "Fiscal Integrity" design tokens in `src/styles.css`)
- Karma + Jasmine for unit tests

## Setup

```bash
npm install
```

`src/environments/environment.ts` ships with:

```ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
  vapidPublicKey: '',
};
```

Runtime overrides via localStorage (no rebuild needed):

```js
localStorage.setItem('FP_API_URL', 'https://api.example.com/api/v1');
localStorage.setItem('FP_VAPID_KEY', '<vapid public key>');
```

Set `FP_VAPID_KEY` to enable push notification subscriptions.

## Development

```bash
npm start        # ng serve, http://localhost:4200
npm test         # unit tests (Karma/ChromeHeadless)
npm run build    # production build -> dist/client/browser
```

`npm run build` also runs `scripts/patch-sw.js`, which appends web-push handlers
(`push` + `notificationclick`) to the emitted `ngsw-worker.js`. Angular's build always
emits the stock Angular service worker from `@angular/service-worker`, so a separate
build step is required for custom push handling.

## Auth & tokens

- Client login (`POST /auth/login/user`) returns JWT tokens stored under `fp_user_access` / `fp_user_refresh`.
- Single-flight refresh interceptor auto-refreshes expired access tokens; the error interceptor toasts API errors (excluding `/auth/` calls).

## Features

- **Dashboard** — greeting, pending uploads, latest report, open filing periods, quick actions.
- **Upload** — multi-file upload (≤50 MB each) via pre-signed URLs with per-file progress/retry; files queued in IndexedDB when offline and resumed automatically.
- **Documents** — filter by status/period, paginated list, detail sheet with secure download links.
- **Reports** — downloadable GST reports (GSTR-1, GSTR-3B, reconciliation, other).
- **Notifications** — read/unread inbox, mark-all-read, deep-links into the app; web push when subscribed.
- **Profile** — phone update, push/email toggles, change password.

## App structure

```
src/app/
  core/           models, api client, auth, toast, feature services, upload + queue,
                  push, interceptors, guards
  features/       auth/login, shell, dashboard, upload, documents, reports,
                  notifications, profile
  shared/         StatusChip, ToastContainer, Spinner, EmptyState, PageHeader
```

Routing: `/login`, `/` (shell → dashboard/documents/reports/profile), `/documents/upload`, `/notifications`. All but `/login` are guarded by `authGuard`.

## Notes

- Requires the Phase 1 backend (`../backend`) running with Postgres and AWS services configured.
- Global styles are plain CSS (`src/styles.css`) so Tailwind v4's `@import`/`@theme` are processed correctly; Angular's application builder only auto-detects JSON PostCSS configs (`postcss.config.json`), not JS ones.
- The service worker manifest uses `navigationRequestStrategy: "freshness"` so the app always loads the latest shell over the network when online.
