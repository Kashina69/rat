# server/ — Express 5 + Prisma + MySQL API

Read `../agents.md` for project-wide rules, `../docs/decisions_made.md` for
target behaviour, and `../docs/project-status.md` for the current state and
known defects. Those two docs override anything you remember about this code.

**Everything in this package is uncommitted working-tree change.** The current
tree typechecks (tests included), lints clean (74 files), builds to
`dist/index.js`, and passes the MySQL suite 12 files / 40 tests.

## Entry points

- `src/index.ts` — boot: `assertProductionEnv()`, `createApp()`, HTTP server + `attachSocket()`, graceful shutdown.
- `src/app.ts` — express wiring: helmet, CORS, JSON limits, `/api` limiter, `/health`, then module routers under `/api/{auth,visits,requirement-lines,sheds,items,logs,dashboard,users}`.
- `src/config/env.ts` — the only env module (`src/env.ts` is a one-line re-export; do not add a third).

## Module map

| Module | Routes | Notes |
|---|---|---|
| `auth` | `POST /login`, `GET /me` | JWT + bcrypt; disabled account → generic 401 |
| `visits` (+ `requirement-lines`) | register/cancel/checkout, shed queue, confirm/cancel line | the stock loop lives here |
| `sheds` | `GET /`, `GET /:code/queue` | queue is SHED/ADMIN and rejects a SHED caller asking for another shed (`403 CROSS_SHED`) |
| `items` | list/create/update/delete, `stock-in`, `adjust` | `GET` is SHED-safe and shed-scoped; the rest is ADMIN |
| `logs` | `GET /` , `GET /export` (CSV), `GET /export.xlsx` (ExcelJS) | same filters on all three; IST day bounds |
| `dashboard` | summary | vehicles inside, pending lines per shed, low stock |
| `users` | `GET /`, `POST /`, `PATCH /:id`, `POST /:id/reset-password` | ADMIN only; `isActive` enable/disable; self-disable blocked |

```
src/modules/<name>/
  <name>.routes.ts      # auth + requireRole + validate wiring only
  <name>.controller.ts  # read validated input, call service, shape response
  <name>.service.ts     # logic + db.$transaction; Prisma lives here only
  <name>.dto.ts         # optional mappers when the shape differs from Prisma
src/validators/<name>.schemas.ts   # zod schemas, one per input
```

Register new routers in `src/app.ts`. Keep one responsibility per file; no
classes (the only class is `ApiError` in `src/utils/errors.ts`).

## Non-negotiables

- Response helpers: `ok` / `okPaginated` / `fail` from `src/utils/responses.ts`; throw `ApiError(code, message, status)` with a stable SCREAMING_SNAKE code.
- Zod at every boundary via `validate` / `validateQuery`; services take `z.infer` types.
- **Ledger invariant:** no `item.currentStock` write without its `stockLedger` row in the same `$transaction`; `SUM(ledger.delta) == currentStock`. Read-then-write stock paths must use `src/utils/rowLocks.ts`. `reason` is `VARCHAR(255)`.
- Statuses come from the Prisma enums and `src/utils/visitStatus.ts` — `AWAITING_LOADING | PARTIALLY_LOADED | READY_FOR_CHECKOUT | CHECKED_OUT | CANCELLED`, lines `PENDING | LOADED | CANCELLED`.
- Shed scoping is enforced here, from the JWT's shed code. Missing shed claim must fail closed (`403 CROSS_SHED`). Client checks are UX only.
- Users: `isActive` is checked in `auth.ts` on every request (`403 ACCOUNT_DISABLED`); login stays a generic 401. Do not add self-signup or last-admin logic casually — the latter is deliberately absent today.
- No secrets or tokens in logs.

## Commands

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
npm run dev          # tsx watch, :5000
npm run typecheck    # tsc --noEmit — covers src, tests, prisma/seed.ts
npm run lint         # biome check  (npm run format to write)
npm run build        # tsc -p tsconfig.build.json → dist/index.js
npm run db:migrate   # prisma migrate dev
npm run db:seed      # tsx prisma/seed.ts  (-- --reset to wipe; refuses in production)
TEST_DATABASE_URL="mysql://dms:dms@127.0.0.1:3306/dms_test" npm test
```

Tests live in `tests/` and are **inside** `tsconfig` include, so `typecheck`
covers them. They need a real MySQL `dms_test` database; `tests/setup-env.ts`
sets `DATABASE_URL` from `TEST_DATABASE_URL` and defaults `JWT_SECRET`, and
`truncateAll` refuses any database whose name does not end in `_test`. Green run:
**12 files / 40 tests** (`users` 8, `logs-export-xlsx` 4, `stock-race` 4,
`logs-date` 5, `item-scoping` 3, `concurrent-confirm` 2, `item-history` 2,
`ledger-invariant` 2, `cross-shed` 1, `checkout-race` 1, `ledger-rollback` 1,
`csv` 7). Do not run migrations or reset the dev database unless the task says so.

Migrations: 1 squashed `init` (full schema, `users.isActive`, `reason 255`),
`migrate status` clean. The init migration is final; add a new migration for
schema changes instead of editing it.

## Current state to keep in mind (details in `../docs/project-status.md`)

Landed in this pass: warn-only stock at confirm, item edits after history, the
`SEED_*_PASSWORD` requirement moved into `seed.ts`, env-driven `TRUST_PROXY`,
shed-scoped `GET /api/items` and `/api/dashboard` with fail-closed
`CROSS_SHED`, IST day bounds for log dates, `P2034` retry, explicit error/DB
mapping, the `users` module, `GET /api/logs/export.xlsx`, ledger `reason`
widening, and the socket `session.expired` event. All uncommitted.

Still open on this side:

- `createVisit` reads items (stock, `isActive`, shed routing) **before** its transaction — a small window.
- `deleteItem` checks usage in a separate transaction from the archive-or-delete decision — a small window.
- `adjustStock` refuses any adjustment ending negative (`409 NEGATIVE_STOCK`); recovery needs stock-in or a positive adjust.
- No socket cross-shed integration test; no CI; `npm audit --omit=dev` reports 5 advisories from Prisma's `deepmerge-ts` and ExcelJS's `uuid`; last-admin protection not implemented.
- Both Docker images still run as root, and neither has ever been built.
