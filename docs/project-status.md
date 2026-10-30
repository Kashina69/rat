> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

# Project status — DMS POC

**Verdict (2026-10-30): the gate→shed→gate loop works end to end.** The review
blockers and majors are fixed, both packages typecheck, lint and build clean, and
the MySQL suite passes 40/40. Unproven is everything outside this machine: no
Docker build, no deployment, no tablet, no demo run. All of it is **uncommitted
working-tree change** (`git status` shows the pass). Target: @docs/decisions_made.md.

## What works

| Area | State | Where |
| --- | --- | --- |
| Login / `me`, bcrypt 12 rounds, JWT ~8 h, role guard, DB errors not masked as 401 | Works | `server/src/modules/auth/`, `server/src/middlewares/auth.ts`, `requireRole.ts` |
| Visit registration with requirement lines, per-item shed routing, status recalc, cancel visit/line | Works (see open item 4) | `visits.service.ts`, `server/src/utils/visitStatus.ts` |
| Gate short-stock warning, warn only | Works | `client/src/components/gate/VehicleForm.tsx` |
| Shed queue + confirm with loaded qty, transactional deduction + one `OUT` ledger row, negative stock allowed, `1..requested`, double confirm `409` no-op; strict checkout; `P2034` deadlock retry | Works; `concurrent-confirm`, `stock-race` tests pass | `visits.service.ts` `confirmLine` / `checkoutVisit`, `rowLocks.ts`, `retry.ts` |
| Inventory: create with `OPENING` row, edit name/category/reorder level anytime, archive + restore, stock-in, signed adjust (qty 0 rejected, minus key on iOS), `includeInactive` accepts `true/false/1/0` | Works; `item-history`, `item-scoping` tests pass | `server/src/modules/items/`, `client/src/components/admin/{InventoryTable,ItemEditor,StockDialogs}.tsx` |
| Users: list, create, edit role/shed/name, enable/disable, reset password, admin Users screen | Works; `users.test.ts` (8) | `server/src/modules/users/`, `client/src/components/admin/{UsersTable,UserEditor}.tsx` |
| In/out log: filters, IST-day bounds, pagination, CSV (BOM, formula neutralisation) and XLSX export | Works; `logs-date`, `csv`, `logs-export-xlsx` pass | `server/src/modules/logs/`, `server/src/utils/{datetime,csv}.ts` |
| Dashboard: vehicles inside, pending lines per shed, low stock; shed-scoped with fail-closed null-shed guard | Works (low stock only, open item 10) | `dashboard.service.ts` |
| Server-side shed scoping on `GET /api/items` and `GET /api/dashboard` (`403 CROSS_SHED`) | Works; `item-scoping` (3), `cross-shed` (1) | `items.service.ts`, `dashboard.service.ts` |
| Realtime rooms + write-then-emit + refetch on event/reconnect; **socket expiry fixed**: `session.expired` → logout, cache cleared, toast, no stale reconnect | Works by code and client build; no device test | `server/src/config/socket.ts`, `client/src/providers/socket-provider.tsx` |
| Screens: login, gate, shed, admin; PWA install/update prompt; logout clears the query cache | Works in the browser; worker change untested on device | `client/src/app/`, `client/public/sw.js`, `client/src/components/pwa/UpdatePrompt.tsx` |
| Ledger invariant `Σ ledger.delta == item.currentStock`, one row per change | Holds; `ledger-invariant`, `ledger-rollback` pass | `server/src/utils/rowLocks.ts` |

## Fixed in this pass

- **Boot/env:** prod API requires only `JWT_SECRET` (≥32) and a `CORS_ORIGIN` allowlist; seed passwords are enforced only when seeding; `--reset` refuses in production; `TRUST_PROXY` env-driven, default 0.
- **Deploy config:** both `NEXT_PUBLIC_*` declared as build args; MySQL unpublished; api/web healthchecks; `web` waits for a healthy `api`; per-context `.dockerignore`.
- **Inventory:** item edit no longer blocked by history; archived rows visible with Restore; signed adjust accepts a minus on iOS and rejects qty 0; ledger `reason` widened to `VARCHAR(255)`.
- **Scoping, errors, logs:** item list and dashboard scope to the caller's shed and fail closed; 413/400/CORS mapped correctly (no more 500); DB outage no longer 401; `P2034` retry added; `from`/`to` are IST depot days; CSV keeps its BOM and neutralises formula cells.
- **Session and PWA:** expiration path above; `sw.js` waits for `SKIP_WAITING` and the prompt reloads once, on tap.
- **Tests:** `tsconfig` includes `tests`; client has a `typecheck` script; `truncateAll` refuses non-`*_test` databases; rollback test asserts the specific failure.
- **Built scope:** users module + admin screen; `GET /api/logs/export.xlsx`.

## Still open

1. **No deployment proof.** No Docker image built, no stack started, no host, HTTPS or public link. Only `docker compose -f docker-compose.prod.yml config` was validated, with dummy secrets.
2. **No device proof.** No tablet install, portrait/landscape, touch-target, keyboard, offline cold launch or service-worker update on a device.
3. **No demo proof.** The scripted 3–5 vehicle run (multi-shed + over-stock) has not been performed; phase-06 boxes were pre-ticked in a docs-only commit and are not evidence.
4. **Two small races.** `createVisit` reads items (stock, `isActive`, shed, short-stock warning) *outside* its transaction; `deleteItem` checks usage in a separate transaction from its archive/delete decision.
5. **`adjustStock` still refuses any adjustment that would end negative** (`409 NEGATIVE_STOCK`) although confirm can drive stock below zero — recovery needs a stock-in or positive adjust.
6. **No CI**, and both images still run as **root** (no `USER` in either Dockerfile).
7. **`npm audit --omit=dev`: 5 advisories (3 high, 2 moderate)** from `deepmerge-ts` (Prisma) and `uuid` (ExcelJS); no non-breaking fix, none in our code.
8. **No socket cross-shed integration test** — `cross-shed.test.ts` covers the REST path only.
9. **No last-admin guard.** Self-disable is blocked, but one admin can disable the only other admin.
10. **Dashboard has low stock only**, not the concept's per-shed current-stock list; the full list is `GET /api/items`.
11. **Doc history:** the original spec and phase plans live in git history; do not implement from them.

## Phase status

| Phase | Status |
| --- | --- |
| 01 Foundation, Docker MySQL, auth, seed | Built. Compose/migrate/seed configured but not re-run in this pass |
| 02 Core APIs | Built; code follows the warn-only stock rule |
| 03 Realtime | Built: rooms, write-then-emit, refetch on reconnect, expiry logout. Gap: no cross-shed socket test |
| 04 Frontend + PWA | Built at browser level. Tablet install, safe areas, offline cold launch untested on device |
| 05 Role screens | Built (gate, shed, admin incl. users). Scripted 3–5 vehicle run not evidenced |
| 06 Hardening + public demo | **Partial.** Artefacts validated in config; build/deploy, device behaviour and the demo run are unproven. Open: CI, non-root images |

## Verification

Node `v22.23.2`; MySQL 8.4 local with `dms` and `dms_test`.

| Check | Command | Result |
| --- | --- | --- |
| Server types (incl. tests) | `cd server && npm run typecheck` | clean |
| Server lint / build | `cd server && npm run lint && npm run build` | clean, 74 files; `dist/index.js` |
| MySQL suite | `cd server && TEST_DATABASE_URL="mysql://dms:dms@127.0.0.1:3306/dms_test" npm test` | **12 files / 40 tests, all pass** |
| Migrations | `cd server && npx prisma migrate status` | clean; **1 squashed init migration** `20261029110447_init` (`users.isActive`, `reason VARCHAR(255)`) |
| Client types / lint / build | `cd client && npm run typecheck && npm run lint && npm run build` | clean, 69 files; Next 16.4.3, `.next/standalone/server.js` |
| Prod compose | `docker compose -f docker-compose.prod.yml config` | valid with dummy secrets |
| Dependency audit | `cd server && npm audit --omit=dev` | 5 advisories (3 high, 2 moderate), no non-breaking fix |

Per-file breakdown: `@docs/06-testing.md`.

**Not performed — do not claim:** `docker compose build`/`up` (dev or prod), any production boot,
deployment/HTTPS/CORS/socket through a proxy, tablet install or orientation/touch checks, PWA update or
offline cold launch on a device, any 3–5 vehicle demo run, any run under Node 20 (images use `node:20-slim`).

## Next order

1. **Build and run the stack** (`docker compose -f docker-compose.prod.yml build`, then `up -d` with real secrets) and load the tablet over HTTPS with a working socket — that turns the config fixes into proof.
2. **Close the two races** in open item 4: move the `createVisit` item read inside its transaction; make `deleteItem`'s usage check and decision one transaction.
3. **Add CI** running typecheck, lint and the MySQL suite, plus a non-root `USER` in both Dockerfiles.
4. **Exercise by hand:** rename an item with history, archive + restore, signed adjust on an iOS tablet, "today" log filter, user create/disable/reset, session-expiry toast.
5. **Decide the minor gaps** (last-admin guard, negative-stock recovery, dashboard stock list, cross-shed socket test) and **earn the phase-06 boxes** with a recorded 3–5 vehicle run on installed tablets instead of pre-ticking.

Related: @docs/decisions_made.md, @docs/00-product-scope.md, @docs/01-architecture.md, @docs/02-data-model.md
