# Fiscal Precision — Admin Web (Phase 2)

Angular 20 admin dashboard for **CA Sanjay Bajaj & Co.** — client management, document review, GST report delivery, filing reminders, staff & permissions, audit log, and filing-period settings.

## Stack

- Angular 20 (standalone components, lazy routes, signals)
- Tailwind CSS v4 (via `@tailwindcss/postcss`, design tokens in `src/styles.css`)
- Karma + Jasmine for unit tests

## Setup

```bash
npm install
```

`src/environments/environment.ts` already ships with:

```ts
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/api/v1',
};
```

The API base URL can be overridden at runtime without rebuilding via browser localStorage:

```js
localStorage.setItem('FP_API_URL', 'https://api.example.com/api/v1');
```

## Development

```bash
npm start        # ng serve, http://localhost:4200
npm test         # unit tests (Karma/ChromeHeadless)
npm run build    # production build -> dist/admin/browser
```

## Auth & tokens

- Login returns only JWT tokens (`access_token`, `refresh_token`); admin identity is decoded from the JWT payload.
- Tokens are stored in `localStorage` under `fp_admin_access` / `fp_admin_refresh`.
- A single-flight refresh interceptor auto-refreshes expired access tokens.

## App structure

```
src/app/
  core/           models, api client, auth, toast, guards, interceptors, upload service
  features/       auth/login, shell, dashboard, clients, documents, reports,
                  reminders, staff, audit, settings
  shared/         StatusChip, Pagination, Modal, EmptyState, PageHeader, Spinner, ToastContainer
```

Routing is permission-gated: `view_clients`, `view_documents`, `upload_reports`, `send_reminders`, `manage_staff`, `view_audit_logs`, `manage_settings` (super admin has all).

## Notes

- Requires the Phase 1 backend (`../backend`) running with Postgres and AWS services configured.
- Global styles are plain CSS (`src/styles.css`) so Tailwind v4's `@import`/`@theme` are processed correctly; Angular's application builder only auto-detects JSON PostCSS configs (`postcss.config.json`), not JS ones.