# Project Status — DMS POC

**Verdict (2026-10-30): the gate→shed→gate loop is implemented end to end. The
four blockers and the main majors from the review are fixed, both packages
build, and the MySQL suite passes 40/40. What is still unproven is everything
outside this machine: no Docker build, no deployment, no tablet, no demo run.**

Read this page first, then `docs/decisions_made.md` (target behaviour).
`docs/specs_document.md` is historical and is wrong about statuses and ledger
fields.

**Important:** every fix described as done below is an **uncommitted
working-tree change**. Nothing has been committed. `git status` will show the
whole pass.

## 1. What works (verified)

This section is now backed by commands, not by reading code. Exact commands and
results are in §6.

| Area | State | Where |
|---|---|---|
| Login / current user, bcrypt 12 rounds, JWT ~8h, role guard, DB errors not masked as 401 | Works | `server/src/modules/auth/`, `server/src/middlewares/auth.ts`, `requireRole.ts`, `server/src/utils/{password,jwt}.ts` |
| Visit registration with requirement lines, per-item shed routing, status recalculation, cancel visit/line | Works (see §3.5 for one small race) | `server/src/modules/visits/visits.service.ts`, `server/src/utils/visitStatus.ts` |
| Gate short-stock warning (warn only, save allowed) | Works | `client/src/components/gate/VehicleForm.tsx` |
| Shed queue + confirm with actual loaded qty, transactional stock deduction + `OUT` ledger row, no on-hand stock block (negative stock allowed), loaded qty `1..requested`, double-confirm `409` no-op | Works; `concurrent-confirm`, `stock-race`, `checkout-race` tests pass | `visits.service.ts` `confirmLine`, `server/src/utils/rowLocks.ts` |
| Strict checkout (blocked until every line is `LOADED`/`CANCELLED`), `P2034` deadlock retry | Works | `visits.service.ts` `checkoutVisit`, `server/src/utils/retry.ts` |
| Inventory: create with `OPENING` row, edit name/category/reorder level at any time (history no longer blocks renames), archive instead of delete with a Restore action, stock-in, signed manual adjust (qty 0 rejected, minus key works on iOS), `includeInactive`/`isActive` accept `true`/`false`/`1`/`0` | Works; `item-history` and `item-scoping` tests pass | `server/src/modules/items/`, `server/src/validators/item.schemas.ts`, `client/src/components/admin/{InventoryTable,ItemEditor,StockDialogs}.tsx` |
| Users: list, create, edit role/shed/name, enable/disable, reset password, `admin` Users screen; disabled login → generic 401; disabled token → `403 ACCOUNT_DISABLED`; self-disable blocked | Works; `users.test.ts` (8 tests) | `server/src/modules/users/`, `src/middlewares/auth.ts`, `client/src/components/admin/{UsersTable,UserEditor}.tsx`, `client/src/hooks/useUsers.ts` |
| In/out log with vehicle/item/shed/status filters, IST-day date bounds, pagination, CSV export with the same filters, BOM and formula neutralisation (including leading whitespace/control chars), Excel export | Works; `logs-date`, `csv`, `logs-export-xlsx` tests pass | `server/src/modules/logs/`, `server/src/utils/{datetime,csv}.ts`, `client/src/components/admin/LogsTable.tsx` |
| Dashboard: vehicles inside, pending lines per shed, low stock — scoped to the caller's shed with a fail-closed null-shed guard | Works (`lowStock` only, §4) | `server/src/modules/dashboard/dashboard.service.ts` |
| Server-side shed scoping on `GET /api/items` and `GET /api/dashboard` (403 `CROSS_SHED` instead of fail-open) | Works; `item-scoping` (3) and `cross-shed` (1) tests pass | `items.service.ts` `listItems`, `dashboard.service.ts` `shedScope` |
| Realtime: rooms `shed:{code}` / `gate` / `admin`, write-then-emit, refetch on invalidation and on reconnect | Works on a fresh connection; expiry path fixed (§2.5) | `server/src/config/socket.ts`, `client/src/hooks/useSocket.ts`, `client/src/providers/socket-provider.tsx` |
| Session expiry: server emits `session.expired`, client ends the session and clears the query cache, toasts "Session expired. Sign in again.", does not reconnect with the stale token; transient errors still reconnect | Works by code + client build; no device test | `server/src/config/socket.ts`, `client/src/providers/socket-provider.tsx`, `client/src/lib/socket-client.ts` |
| Screens: login, gate (register, inside list, checkout), shed (queue, confirm, own stock), admin (dashboard cards, inventory, users, logs) | Works | `client/src/app/{login,gate,shed,admin}/page.tsx` |
| PWA: manifest, icons, offline page, install button, connection badge, user-gated update prompt (`SKIP_WAITING` only on tap, reload only after the user applies, once) | Works in the browser; worker change not device-tested | `client/src/app/manifest.ts`, `client/public/sw.js`, `client/src/components/pwa/UpdatePrompt.tsx` |
| Logout clears the TanStack cache as well as in-memory auth state | Works | `client/src/providers/auth-provider.tsx` |
| Ledger invariant — one append-only row per stock change, `SUM(ledger.delta) == item.currentStock` | Holds; `ledger-invariant` and `ledger-rollback` tests pass | `server/src/utils/rowLocks.ts`, `server/tests/ledger-*.test.ts` |

## 2. Blockers and majors from the review: now fixed

| # | Problem as raised | Current state | Evidence |
|---|---|---|---|
| 1 | Production API refused to boot: `assertProductionEnv()` demanded all four `SEED_*_PASSWORD` vars on every prod start | **Fixed.** `server/src/config/env.ts` only enforces `JWT_SECRET` (≥32, non-default) and an explicit `CORS_ORIGIN` allowlist; the seed-password requirement sits in `server/prisma/seed.ts`, which also refuses `--reset` in production | `env.ts` `assertProductionEnv`, `seed.ts` reset guard |
| 2 | Production web bundle called `localhost`: `NEXT_PUBLIC_*` are build-time in Next but no build args were passed | **Fixed.** `client/Dockerfile` declares `ARG`/`ENV` for both values; `docker-compose.prod.yml` passes them under `web.build.args` as required | `client/Dockerfile`, `docker-compose.prod.yml` lines 60-72 |
| 3 | Inventory name/category edit always failed: every item has an `OPENING` ledger row, so `updateItem` returned `409 ITEM_HAS_HISTORY` | **Fixed.** The history guard is gone; `updateItem` applies name/category/reorderLevel/isActive and audits `ITEM_UPDATED` / `ITEM_ARCHIVED` | `items.service.ts` `updateItem`; `item-history.test.ts` |
| 4 | PWA update flow broken: install-time `skipWaiting()` plus unconditional reload on `controllerchange` | **Fixed.** `sw.js` waits until a `SKIP_WAITING` message; `UpdatePrompt.tsx` arms on a waiting worker and reloads only after the user applies, once | `client/public/sw.js`, `client/src/components/pwa/UpdatePrompt.tsx` |
| 5 | Shed read scoping missing on `GET /api/items` and `GET /api/dashboard`; null-shed guard fail-open | **Fixed.** Both scope to the caller's shed and fail closed with `403 CROSS_SHED` | `items.service.ts`, `dashboard.service.ts`; `item-scoping.test.ts` |
| 6 | Log `from`/`to` were UTC instants, so `to=today` dropped the IST day | **Fixed.** Filters are depot-local IST days (`istDayStartUtc` / `istDayEndUtc`) | `server/src/utils/datetime.ts`; `logs-date.test.ts` (5) |
| 7 | Socket expiry force-disconnected and the client never reauthenticated | **Fixed.** Server emits `session.expired` before disconnecting; client ends the session, clears the cache, toasts and stops reconnecting with the stale token | `socket.ts` `SESSION_EXPIRED_EVENT`, `socket-provider.tsx` `endSession` |
| 8 | Logout left the previous user's cached data on a shared tablet | **Fixed.** Logout clears the TanStack Query cache | `auth-provider.tsx` |
| 9 | `trust proxy 1` was unconditional | **Fixed.** `TRUST_PROXY` is env-driven, default 0 | `server/src/config/env.ts` |
| 10 | Error handler turned 413/400/CORS rejections into 500; DB outage became 401 | **Fixed.** Mapped explicitly in `errorHandler.ts` / `auth.ts` | `server/src/middlewares/` |
| 11 | Seed `--reset` had no production guard; upserts never updated passwords | **Fixed.** `--reset` refuses in production unless explicitly allowed; upserts refresh password hashes | `server/prisma/seed.ts` |
| 12 | Archived items invisible, no restore path | **Fixed.** Admin inventory requests `includeInactive=true`, marks archived rows, and offers a Restore action that flips `isActive` back on | `InventoryTable.tsx` lines 23-195, `items.service.ts` `updateItem` |
| 13 | Signed adjust used `inputMode="numeric"` (no minus on iOS) and accepted qty 0 | **Fixed.** Text input with sanitisation; `qty === 0` → `400 INVALID_QTY` | `StockDialogs.tsx`, `items.service.ts` |
| 14 | No `P2034` deadlock retry despite the plan claiming it | **Fixed.** `withDeadlockRetry` in `server/src/utils/retry.ts` | `retry.ts` |
| 15 | Deploy hygiene: MySQL port published, no healthchecks, inert `.dockerignore`, missing build args | **Fixed** in config: MySQL unpublished, api/web healthchecks, `web` waits for `api` healthy, per-context `.dockerignore`, build args required | `docker-compose.prod.yml`, `server/.dockerignore`, `client/.dockerignore` |
| 16 | Test hygiene: tests outside tsconfig, no client typecheck script, no `JWT_SECRET` in setup, unsafe truncate, loose rollback assertion | **Fixed.** `tsconfig` includes `src`, `tests`, `prisma/seed.ts`; client has `typecheck`; `setup-env.ts` defaults `JWT_SECRET`; `truncateAll` refuses any DB not ending `_test`; the rollback test asserts the specific failure | `server/tsconfig.json`, `tests/setup*.ts`, `client/package.json` |
| 17 | User management and `.xlsx` export were unbuilt scope | **Built.** Users module + admin screen; `GET /api/logs/export.xlsx` via `exceljs` 4.4.0 + admin button | §1 rows |
| 18 | Ledger `reason` too narrow for real notes | **Fixed.** `reason` widened to `VARCHAR(255)` in the squashed init migration | `20261029110447_init` |

## 3. Still open (verified open at the end of this pass)

1. **No deployment proof.** No Docker image was built, no stack was brought up, no production host, HTTPS or public link exists. Only `docker compose -f docker-compose.prod.yml config` was validated with dummy secrets. Blockers 1, 2 and 4 are fixed in configuration; they are only *proven* once the stack runs.
2. **No device proof.** No tablet installation, no portrait/landscape check, no touch-target or keyboard check, no offline cold launch, no service-worker update on a real device.
3. **No demo proof.** The scripted 3–5 vehicle run (including a multi-shed vehicle and an over-stock case) has not been performed. `docs/phases/phase-06-hardening-demo.md` still marks those boxes `[x]`; they were flipped in a docs-only commit and are not evidence.
4. **No CI.** Biome, `tsc` and Vitest are run by hand; nothing blocks a broken commit. Both images still run as **root** (no `USER` in either Dockerfile).
5. **`createVisit` reads items before its transaction.** `visits.service.ts` does `db.item.findMany` (stock, `isActive`, shed routing and the short-stock warning) outside the `$transaction`, so an item archived or repriced in between can slip through. Small window, worth closing.
6. **`deleteItem` checks usage in a separate transaction.** The requirement-line/ledger lookup and the archive-or-delete decision are two transactions, so a line created between them can be missed. Small window.
7. **`adjustStock` still refuses any adjustment that would end negative** (`409 NEGATIVE_STOCK`), even though confirm can legitimately drive stock below zero. Recovering from negative stock needs a stock-in or a positive adjust.
8. **No socket cross-shed integration test.** `cross-shed.test.ts` covers the REST path only; room isolation is asserted by reading `socket.ts`.
9. **`npm audit --omit=dev`: 5 advisories (3 high, 2 moderate)**, all from transitive dependencies of Prisma (`deepmerge-ts`) and ExcelJS (`uuid`). No non-breaking fix is available. Neither is application code we wrote.
10. **Last-admin protection is not implemented.** An admin cannot disable *themselves*, but one admin can disable the only other admin.
11. **Dashboard has only low stock**, not the concept's full per-shed current-stock list (§4).
12. **Doc drift that remains:** `docs/specs_document.md` is historical (banner only, content untouched); `docs/implementation_plan.md` is referenced by older notes but does not exist.

## 4. Agreed but still missing

- **Dashboard current-stock list** — only `lowStock` (`currentStock <= reorderLevel`) is served; there is no per-shed current-stock table as the concept described.

Everything else that decision 1 promised — including user management and Excel export — is built (see §1).

## 5. Phase-by-phase status

| Phase | Doc | Status |
|---|---|---|
| 01 Foundation, Docker MySQL, auth, seed | `docs/phases/phase-01-foundation.md` | Built: structure, Prisma schema, login/me, seed with 4 logins, dev Docker MySQL. The compose/migrate/seed path is configured but was not re-run in this pass |
| 02 Core APIs | `docs/phases/phase-02-core-apis.md` | Built. Its checklist still states the superseded blocking rule (`Confirm more than stock → 409 INSUFFICIENT_STOCK`); the code follows warn-only, so read that line as history, not spec |
| 03 Realtime | `docs/phases/phase-03-realtime.md` | Built: rooms, write-then-emit, refetch on reconnect, expiry logout. Gap: no cross-shed socket integration test |
| 04 Frontend foundation + PWA | `docs/phases/phase-04-frontend-pwa.md` | Built at browser level: shell, providers, manifest, SW, offline page, update prompt. Tablet install, safe areas and offline cold launch untested on device |
| 05 Role screens | `docs/phases/phase-05-role-screens.md` | Built: gate, shed and admin screens (including users) and hooks. Scripted 3–5 vehicle run on installed tablets not evidenced |
| 06 Hardening + public demo | `docs/phases/phase-06-hardening-demo.md` | **Partial.** Artefacts exist and are validated: Dockerfiles, standalone prod compose with healthchecks and build args, 40-test suite green, CSV/Excel escaping, users module, socket expiry logout, retry helper, demo script. Unproven: build/deploy, device behaviour, the demo run. Also open: CI, non-root images, socket cross-shed test |

## 6. Verification: performed vs not performed

Node `v22.23.2` from `/home/prince/.nvm/versions/node/v22.23.2/bin` for every
command. MySQL 8.4 running locally with `dms` and `dms_test`.

**Performed — green:**

| Check | Command | Result |
|---|---|---|
| Server types (incl. tests) | `cd server && npm run typecheck` | clean |
| Server lint | `cd server && npm run lint` | clean, 74 files |
| Server build | `cd server && npm run build` | clean, `dist/index.js` |
| MySQL suite | `cd server && TEST_DATABASE_URL="mysql://dms:dms@127.0.0.1:3306/dms_test" npm test` | **12 files / 40 tests, all pass** |
| Migrations | `cd server && npx prisma migrate status` | clean; 1 squashed init migration includes `users.isActive` and `reason VARCHAR(255)` |
| Client types | `cd client && npm run typecheck` | clean |
| Client lint | `cd client && npm run lint` | clean, 69 files |
| Client build | `cd client && npm run build` | clean, Next 16.4.3, `.next/standalone/server.js` produced |
| Prod compose | `docker compose -f docker-compose.prod.yml config` | valid with dummy secrets; MySQL unpublished, healthchecks present, `web` depends on `api` healthy, both `NEXT_PUBLIC_*` as build args |
| Dependency audit | `cd server && npm audit --omit=dev` | 5 advisories (3 high, 2 moderate) from `deepmerge-ts` and `uuid`; no non-breaking fix |

Test files (40 tests): `users` 8, `logs-export-xlsx` 4, `stock-race` 4,
`logs-date` 5, `item-scoping` 3, `concurrent-confirm` 2, `item-history` 2,
`ledger-invariant` 2, `cross-shed` 1, `checkout-race` 1, `ledger-rollback` 1,
`csv` 7.

**Not performed — do not claim these as done:**

- `docker compose build` / `up`, dev or prod; no production boot ever attempted.
- Public deployment, HTTPS, CORS against a real origin, socket through a proxy.
- Tablet installation, portrait/landscape, touch targets, on-screen keyboards, iOS keypad.
- PWA update on a device; offline cold launch on a device.
- Any 3–5 vehicle demo run.
- Any run under Node 20 (the images use `node:20-slim`); all checks above ran on Node 22.

## 7. Recommended next order

1. **Build and run the stack.** `docker compose -f docker-compose.prod.yml build`, then `up -d` on a host with real secrets, and confirm the tablet loads over HTTPS with a working socket. That is what turns blockers 1, 2 and 4 from "fixed" into "proven".
2. **Close the two small races** — move the `createVisit` item read into its transaction (§3.5), and make `deleteItem`'s usage check and archive/delete decision one transaction (§3.6).
3. **Add CI** running `typecheck`, `lint` and the MySQL suite, and add a non-root `USER` to both Dockerfiles.
4. **Exercise the admin and device paths by hand:** rename an item with history, archive and restore, signed adjust on an iOS tablet, log filter for "today", user create/disable/reset-password, and the session-expiry toast.
5. **Decide on the remaining minor gaps:** last-admin protection (§3.10), ability to recover from negative stock via adjust (§3.7), dashboard current-stock list (§4), a socket cross-shed test (§3.8).
6. **Earn the phase-06 boxes.** Run the demo script with 3–5 vehicles including a multi-shed and an over-stock case, on installed tablets, and record the outcome here instead of pre-ticking the checklist.
