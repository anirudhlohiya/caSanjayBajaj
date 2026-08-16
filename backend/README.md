# Backend API — NestJS (Phase 1)

Node.js 22 + NestJS (TypeScript) + PostgreSQL (TypeORM) + AWS (S3 / SES / FCM).

## Setup

1. `cp .env.example .env` and fill values (see `../docs/02-trd.md` for AWS setup steps).
2. `npm install`
3. Create the schema: `npm run migration:run`
4. Bootstrap super admin + filing periods: `npm run seed`
5. Run: `npm run start:dev`

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:dev` | Dev server with watch |
| `npm run build` | Type-check + compile to `dist/` |
| `npm run lint` | ESLint (recommendedTypeChecked) |
| `npm test` | Unit tests (jest) |
| `npm run test:e2e` | E2E tests |
| `npm run migration:run` | Apply DB migrations |
| `npm run migration:revert` | Revert last migration |
| `npm run migration:generate -- src/database/migrations/Name` | Generate a migration from entity changes |
| `npm run seed` | Seed super admin + default filing periods |

## API surface

Base path: `/api/v1` — Swagger docs: `/api/docs` (when running).

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login/user`, `/auth/login/admin`, `/auth/refresh`, `/auth/logout` |
| Profile (client) | `GET/PATCH /me`, `/me/change-password`, `/me/device-token` |
| Users (admin) | `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id` |
| Periods | `GET /periods`, `GET /periods/open`, `POST/PATCH /periods` (admin) |
| Documents | `POST /documents/upload-url`, `POST /documents/:id/confirm`, `GET /documents/:id/download-url`, `GET /me/documents`, `GET /admin/documents`, `GET /admin/users/:userId/documents`, `PATCH /admin/documents/:id/processed` |
| Reports | `POST /admin/reports`, `POST /admin/reports/:id/confirm`, `GET /me/reports`, `GET /admin/reports`, `GET /admin/users/:userId/reports`, download URLs |
| Reminders | `POST /admin/reminders/send`, `GET /admin/reminders/log` (auto cron at 08:00 daily) |
| Staff | `GET/POST /admin/staff`, `GET/PATCH/DELETE /admin/staff/:id`, `GET/PUT /admin/staff/:id/permissions` |
| Audit | `GET /admin/audit-logs` |

## Key flows

- **Upload:** `POST /documents/upload-url` → pre-signed S3 PUT → client PUTs to S3 → `POST /documents/:id/confirm` marks `received`.
- **Report delivery:** admin uploads report → on confirm, push (FCM/VAPID) + email (SES) notify the client with an in-app link.
- **Reminders:** manual via `/admin/reminders/send`; automatic via cron for open periods within `REMINDER_LEAD_DAYS` of `due_date`.

## Notes

- Database and files must be configured before the API will start (env-driven).
- AWS credentials are read only from the environment — never commit `.env`.
- See `../docs/05-backend-schema.md` for the schema and `../docs/03-app-flow.md` for flows.