> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

# 01 — Architecture

Three tablets, one API, one database. Every screen calls the same Express API, which
owns every rule; MySQL is the only source of truth; Socket.IO carries hints, never
data. Scope: @docs/00-product-scope.md · Contract: @docs/03-api-contract.md · Schema: @docs/02-data-model.md.

## Shape

```text
[Gate|Shed|Admin tablets] ─ REST /api/* (Bearer JWT) ─ Express 5 ─ Prisma 6 ─ MySQL 8.4
                              ▲                                    │
                              └──── Socket.IO hints ◄───────────────┘ after commit
```

- Next 16 PWA shell (`client/`) and `server/` are separate containers behind one HTTPS origin; no cache layer, no queue, no second service.
- REST for every read and write. Socket.IO only says "something changed, refetch"; payloads carry ids and timestamps, never balances or records.

## Stack

Versions from both `package.json` files and the Dockerfiles (2026-10-30).

| Layer | Technology | Version | Why |
| --- | --- | --- | --- |
| Runtime / deploy | Node local and in images; Docker Compose dev file + self-contained `docker-compose.prod.yml` | v22.23.2 local; `node:20-slim` image, `engines.node >= 20`; `mysql:8.4` | Local checks are not proof of image behaviour; one repo, one command, reproducible demo host |
| Language | TypeScript, `strict: true` | `^5.7.2` server, `^5` client | `tsc -p tsconfig.build.json` → `dist/index.js`; client via `tsc --noEmit` |
| Frontend | Next.js App Router PWA; React / React DOM + React Compiler | `16.4.3`; `19.3.0` exact | Installable without an app store; built-in `manifest.ts`, standalone output, `cacheComponents`, hand-written `client/public/sw.js` instead of `next-pwa` (`NEXT_PUBLIC_*` are build args); plain function components, no memoisation ceremony |
| Styling | Tailwind + `@tailwindcss/turbopack`, local shadcn-style primitives | `^4` | Large tablet touch targets, no component-library lock-in |
| Client state | TanStack Query (keys in `client/src/lib/query-keys.ts`); react-hook-form + Zod resolvers | `^5.105.0`; `^7.91.0`, `^6.0.2` | Server state with refetch-on-event; same Zod major both sides; no Zustand/Redux |
| Backend | Express; helmet, cors allowlist, express-rate-limit; Zod at every boundary (`validate` / `validateQuery`) | `^5.3.0`; `^8.1.0`, `^2.8.5`, `^8.7.2`; `^4.6.7` | Native async error propagation keeps handlers thin; hardening needs no external service; controllers never see raw input |
| ORM / DB | Prisma / `@prisma/client` on MySQL | `^6.19.3`, `8.4` | Typed queries, migration history, `$transaction` for stock paths. MySQL is a deliberate deviation from the concept's PostgreSQL (depot familiarity); no Postgres-only SQL |
| Realtime | Socket.IO server / client | `^4.8.4` / `^4.8.4` | Rooms + reconnection on flaky tablet Wi-Fi; chosen over polling/SSE |
| Auth | jsonwebtoken + bcryptjs (12 rounds) | `^9.0.3` / `^3.0.3` | No native build step, no session store, access-only tokens |
| Export | exceljs in `logs/logs.service.ts` | `^4.4.0` | Real `.xlsx` with number cells, no office dependency; CSV stays hand-rolled in `src/utils/csv.ts` |
| Quality | Vitest + Supertest on real MySQL `dms_test`; Biome + `tsc --noEmit`; tsx watch | `^5.0.5`, `^7.3.1`; `^2.4.2`; `^4.19.2` | Locks and transactions need a real DB, not a mocked Prisma; one lint+format tool; no CI exists |

Deliberate non-choices: PostgreSQL (replaced by MySQL 8.4), Redis or any queue
(stock writes must be synchronous), refresh tokens / revocation store / session
table (controlled tablets, 8 h shift), offline mutation queue (offline = read
stale), native app (PWA covers tablets), `next-pwa`/Workbox (auditable worker),
socket-delivered state, client stores, ESLint + Prettier, Drizzle/TypeORM/raw SQL,
CI, error tracking. Gaps: @docs/project-status.md.

## Request → transaction → push

The confirm step is the whole system in miniature
(`server/src/modules/visits/visits.service.ts`):

1. **Request.** `POST /api/requirement-lines/:id/confirm` with `{ loadedQty }`: `/api` limiter, then `auth` (JWT → re-read user row, `403 ACCOUNT_DISABLED`), `requireRole("SHED", "ADMIN")`, then Zod.
2. **Rules first.** Line must be the caller's shed (unless `ADMIN`), still `PENDING`, and `loadedQty` within `1..requestedQty`. A second confirm is a 409 with no state change.
3. **One interactive Prisma transaction**, locking visit → line → item so confirms cannot interleave: reject `CHECKED_OUT`/`CANCELLED` visits; decrement `Item.currentStock` and compute `balanceAfter` under the lock; set the line `LOADED` with `loadedQty`, `confirmedByUserId`, `confirmedAt`; insert exactly one `StockLedger` row (`OUT`, negative `delta`); recompute visit status (`recalcVisitStatus`); write an `AuditEvent`.
4. **Commit.** Any throw rolls stock, line, ledger and audit back together. Stock-mutating paths retry once on a MySQL deadlock (`P2034`, `withDeadlockRetry`).
5. **Push after commit.** Only then emit `loading.confirmed`, `visit.statusChanged`, `stock.updated`, `inventory.changed` to the relevant rooms. A socket failure is swallowed; inventory is never rolled back because a hint failed.
6. **Client reacts.** `client/src/providers/socket-provider.tsx` owns every listener and invalidates the TanStack Query cache per event, so all three role screens refetch without a manual refresh; everything refetches on reconnect.

Same shape (validate → transaction → one ledger row → audit → emit) for visit create, line/visit cancel, checkout, item create, stock-in and adjust; user management is transaction + audit, no socket event.

## Backend module map

Route → controller → service → Prisma, one folder per module under
`server/src/modules/`; Zod schemas in `server/src/validators/`.
`server/src/app.ts` wires middleware in order: helmet, CORS allowlist, 100 kB
JSON/urlencoded limits, `/api` limiter, `/health`, module routes, 404, central
error handler.

| Module | Responsibility / files | Guard |
| --- | --- | --- |
| auth | login (tighter limiter) and `me`; `auth.*` | login public, `me` authenticated |
| users | account create/update, role + shed assignment, enable/disable, password reset; `users.*` | router-level `auth` + `ADMIN` |
| visits | visit create/list/cancel/checkout, plus `requirementLinesRoutes` mounted separately at `/api/requirement-lines` (line cancel/confirm); `visits.*`, `visits.dto.ts` | `GATE`/`ADMIN`; confirm `SHED`/`ADMIN` |
| sheds | shed list and per-shed live queue; `sheds.*` | list any authenticated; queue `SHED` (own code) / `ADMIN` |
| items | inventory list/create/update/archive, stock-in, adjust; `items.*` | list any authenticated; rest `ADMIN` |
| logs | filtered log list, CSV and XLSX export; `logs.*` | `ADMIN` |
| dashboard | inside count, per-shed pending, low stock; `dashboard.*` | `ADMIN`, `GATE`, `SHED` |
| health | `GET /health`, mounted outside `/api` | public, no rate limit |

Cross-cutting: `config/env.ts` (`assertProductionEnv()` from `index.ts`);
`config/socket.ts` (handshake, rooms, `session.expired` timer); `middlewares/`
(`auth`, `requireRole`, `validate`, `limiters`, `errorHandler` → one `{ error }`
shape); `utils/` (`jwt`, `password`, `csv`, `rowLocks`, `visitStatus`, `retry`,
`audit`, `responses`, `errors`, `datetime`). Responses are `{ data }` or
`{ error: { code, message } }`.

## Roles and rooms

Rooms are assigned by the server from the verified identity; a client cannot pick its own room.

| Role | Room | Joined when |
| --- | --- | --- |
| `SHED` | `shed:{code}` (e.g. `shed:SHED-A`) | handshake, using the shed code read from the database |
| `GATE` | `gate` | handshake |
| `ADMIN` | `admin` | handshake |

Visit events go to `gate` + `admin` + every shed on the visit; item/inventory
events to `gate` + `admin` + the item's shed. `session.expired` goes to one
socket, then that socket is disconnected. Details: @docs/03-api-contract.md.

## Auth and session

- **Login.** bcrypt compare (12 rounds) → JWT. Unknown username, wrong password and a disabled account all return the same `401 INVALID_CREDENTIALS`.
- **Token.** HS256, access only, ~8 h (`JWT_EXPIRES_IN`), payload `userId`, `role`, `shedCode`; no refresh, no revocation list, logout is client-side. `shedCode` is joined from `sheds`, never stored on `users`.
- **Per request.** `auth` re-reads the user row: missing → `401 UNAUTHORIZED`, disabled → `403 ACCOUNT_DISABLED` — which is what makes disabling take effect immediately for REST.
- **Client storage.** Token lives in React auth context, sent as `Bearer` by `client/src/lib/api-client.ts`; never `localStorage`, never a cookie, never cached by the service worker, so a cold launch is logged out by design.
- **Authorisation.** `requireRole` gates routes; the client `RoleGuard` only chooses a screen. Shed scoping is server-side.
- **Socket auth.** Handshake reads `socket.handshake.auth.token`, verifies with the same secret, loads the user and joins rooms from the DB record; a `SHED` without a shed code is disconnected.
- **Transport.** HTTPS required in a real deploy (PWA install). CORS is an exact-origin allowlist from `CORS_ORIGIN`, shared by Express and Socket.IO.

## Strategy

| Rule | Meaning |
| --- | --- |
| REST is the source of truth | The socket never carries state; screens recover by refetching over HTTP, so a missed event degrades to stale-until-refetch, never wrong data |
| Write then push | Commit first in one transaction, emit after; no event describes an uncommitted or rolled-back change |
| Row locks over optimism | `SELECT … FOR UPDATE` in fixed order (visit → line → item) via `server/src/utils/rowLocks.ts`, plus one retry on `P2034` |
| Ledger invariant | Every stock change writes exactly one `stock_ledger` row in the same transaction; `Σ delta = Item.currentStock` always holds (@docs/02-data-model.md) |
| Fail-closed shed scoping | A `SHED` caller with no shed, or asking for another shed, gets `403 CROSS_SHED` in the services: item list, dashboard, queue, line confirm |
| Append-only ledger | Rows are inserted once; corrections are compensating `ADJUST` rows. Unique `requirementLineId` makes a double confirm impossible at DB level |

## Accepted risks

| # | Risk | Why acceptable now | Cost later |
| --- | --- | --- | --- |
| 1 | Single API instance, no clustering or sticky sessions | Demo load is three tablets | A second instance splits rooms → need Redis adapter or sticky sessions |
| 2 | No Redis, no transactional outbox; push is in-process after commit | One process, one commit path | A crash between commit and emit loses that hint until reconnect/focus refetch |
| 3 | Token in memory only | Nothing to steal from disk on shared tablets | Cold launch requires a fresh login; no "remember me" |
| 4 | No refresh token or revocation list | One shift, small trusted user set; auth re-reads the row per request | A leaked token stays valid on the socket path until expiry; only disabling the account cuts REST access |
| 5 | In-memory rate limiting | Cheap, no infrastructure | Counters reset on restart, per-process |
| 6 | No offline mutations or queue | Prevents invented stock numbers and duplicate loads on flaky Wi-Fi | Depot cannot work through an outage; reads only |
| 7 | Socket-only live updates, no polling | One mechanism, simple to reason about | A dead socket falls back to focus/reconnect refetch; no timed poll |
| 8 | No last-admin guard | One depot officer account, managed by hand | Two admins can disable each other and leave no `ADMIN` login; manual DB/seed recovery |

Related: @docs/00-product-scope.md, @docs/02-data-model.md, @docs/03-api-contract.md, @docs/04-setup-and-deploy.md
