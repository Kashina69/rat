# 07 — Testing

The backend has an integration suite that runs against a **real MySQL 8.4 database** — no sqlite, no
mocks — plus a factory layer and a ledger-invariant checker.

**Headline (2026-10-30): 12 files, 40 tests, all passing** against `dms_test`. Nothing runs
automatically yet — there is no CI — and the realtime layer, the PWA and the tablets are still
manual-only. Track the open items in [`docs/project-status.md`](./project-status.md); target
behaviour is in [`docs/decisions_made.md`](./decisions_made.md).

---

## 1. Stack

| Piece | What it is |
|---|---|
| Runner | Vitest (`vitest run`) — `server/vitest.config.ts` |
| HTTP | Supertest against `createApp()` — the real Express app, no listening socket needed |
| Database | Real MySQL 8.4, dedicated schema `dms_test`, tables created by `prisma migrate deploy` |
| Fixtures | `server/tests/factories.ts` (sheds, users, items, visits with lines) |
| Isolation | `truncateAll()` before each test; `fileParallelism: false` so files never overlap |
| Timeouts | `testTimeout: 30_000` per test; migrations run once per test run |

`server/vitest.config.ts`: `environment: "node"`, `setupFiles: ["./tests/setup-env.ts"]`,
`testTimeout: 30_000`, `fileParallelism: false`. `server/package.json` exposes one script:
`"test": "vitest run"`.

Tests are **typechecked**: `server/tsconfig.json` includes `["src", "tests", "prisma/seed.ts"]`, so
`npm run typecheck` fails on a wrong signature or renamed field in a test. The production build
(`tsconfig.build.json`) includes only `src` and excludes `tests`, so no test file reaches `dist`.

---

## 2. Prerequisites

1. **MySQL must be up and reachable.** The dev container (`docker compose up -d mysql`, published on
   `localhost:3306`, user `dms`/`dms`) is what was used.
2. **The `dms_test` database must already exist** — the setup runs `migrate deploy`, which creates
   tables, not the schema:

   ```bash
   docker compose exec mysql mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS dms_test;"
   ```

3. **`TEST_DATABASE_URL` must be set** on the command line (or exported). There is no fallback.

---

## 3. How to run

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
cd /home/prince/code/office/projects/rit/server

TEST_DATABASE_URL=mysql://dms:dms@127.0.0.1:3306/dms_test npm test
```

This exact command produced the result in §4.

What happens:

- `tests/setup-env.ts` requires `TEST_DATABASE_URL`, copies it into `DATABASE_URL`, forces
  `NODE_ENV=test`, and sets a **test-only `JWT_SECRET`** when none is present. The run does not
  depend on `server/.env`.
- Each file's `beforeAll` calls `migrateTestDb()`; the `prisma migrate deploy` promise is shared
  through `globalThis`, so it runs once per test run, not once per file.
- Every test calls `truncateAll()` first, which **refuses any database whose name does not end in
  `_test`**, so a mistyped URL aborts instead of wiping `dms`.

Single file or single test:

```bash
TEST_DATABASE_URL=mysql://dms:dms@127.0.0.1:3306/dms_test npx vitest run tests/checkout-race.test.ts
TEST_DATABASE_URL=mysql://dms:dms@127.0.0.1:3306/dms_test npx vitest run -t "duplicate checkout"
```

Notes:

- `npm test` is `vitest run` (no watch). Use bare `npx vitest` for watch mode.
- The suite is destructive by design. Never point `TEST_DATABASE_URL` at `dms`.

---

## 4. Result and per-file coverage

Last full run: **12 files, 40 tests, all pass**, database `dms_test`, MySQL 8.4, Node 22.23.2.

| File | Tests | What it asserts |
|---|---:|---|
| `tests/users.test.ts` | 8 | Create user never returns `passwordHash`; duplicate username `409 DUPLICATE`; `SHED` requires a shed and other roles forbid one; a disabled user cannot log in (`401`) and a pre-existing token gets `403 ACCOUNT_DISABLED`; reset password changes the login; admin cannot disable itself (`409 CANNOT_DISABLE_SELF`); role and shed stay consistent on update; non-admin is refused (`403`). |
| `tests/csv.test.ts` | 7 | Pure unit tests of `toCsv`: plain cells quoted, embedded quotes doubled, `=`/`+`/`-`/`@` cells prefixed with `'`, a leading tab cannot bypass neutralisation, leading spaces/control characters cannot either, negative numbers keep the prefix, every cell quoted with CRLF line endings. |
| `tests/logs-date.test.ts` | 5 | `YYYY-MM-DD` maps to IST day bounds (midnight window, month/year/leap-day edges), non-date values fall back to instant parsing, a visit at the IST day boundary belongs to that IST day, and `GET /api/logs` applies the window to `from`/`to`. |
| `tests/logs-export-xlsx.test.ts` | 4 | `GET /api/logs/export.xlsx` returns a formatted ADMIN workbook (headers, bold header, frozen row), rows keep CSV order and formula-like values stay plain text, the workbook applies the same filters as the CSV, and the endpoint is ADMIN-only. |
| `tests/stock-race.test.ts` | 4 | Two visits wanting 8 each against stock 10 → both confirms `200`, stock exactly `-6`, two `-8` OUT rows, invariant holds; an over-stock confirm deducts the requested qty with one OUT row; `loadedQty > requested` → `400` with no deduction; a pending line of an archived item can still be confirmed. |
| `tests/item-scoping.test.ts` | 3 | A SHED caller lists only its own shed's items; asking for another shed's items is `403 CROSS_SHED`; `GET /api/dashboard` is scoped to the caller's shed. |
| `tests/concurrent-confirm.test.ts` | 2 | Two simultaneous confirms of the same line → one `200`, one `409 ALREADY_CONFIRMED`, stock exactly `100 → 90`, exactly one `OUT` row of `-10`, invariant holds; two sheds confirming their own lines concurrently → both `200`, visit ends `READY_FOR_CHECKOUT`. |
| `tests/item-history.test.ts` | 2 | Rename and recategorise succeed after stock history and write an audit row; a stock adjustment of zero is rejected and never reaches the ledger. |
| `tests/ledger-invariant.test.ts` | 2 | `SUM(delta) == currentStock` after stock-in, confirm and adjust; the scan catches drift on an item the caller did not name. |
| `tests/cross-shed.test.ts` | 1 | Shed A's token confirming Shed B's line over HTTP → `403 CROSS_SHED`, line still `PENDING`, stock unchanged. REST only — no socket equivalent. |
| `tests/checkout-race.test.ts` | 1 | Two simultaneous `POST /api/visits/:id/checkout` → one `200`, one `409`, final status `CHECKED_OUT`, exactly one `VISIT_CHECKOUT` audit row. |
| `tests/ledger-rollback.test.ts` | 1 | A pre-inserted `OUT` row bound to the same `requirementLineId` (`@unique`) makes the confirm fail with Prisma `P2002`; stock stays `50`, line stays `PENDING`/unconfirmed, visit unchanged — nothing persisted. |
| **Total** | **40** | — |

Support files (no tests): `tests/setup-env.ts` (env guard + test JWT secret),
`tests/setup.ts` (Prisma client, `migrateTestDb`, `truncateAll` with the `_test` guard, `ledgerSum`,
`assertLedgerInvariant`), `tests/factories.ts` (`makeShed`, `makeUser`, `makeItem` with its `OPENING`
row, `makeVisitWithLines`).

**Not covered by any test:** login/throttling beyond the disabled cases above, token expiry and the
socket `session.expired` path, item create/archive-restore, stock-in and manual-adjust limits
(other than qty 0), pagination, dashboard content beyond shed scoping, Socket.IO delivery, PWA /
service-worker behaviour.

---

## 5. The invariants the suite protects

1. **One line, one deduction.** A requirement line is confirmed once; the second attempt gets
   `409 ALREADY_CONFIRMED` and changes nothing. Enforced by a row lock plus a status check, and
   backed by `stock_ledger.requirementLineId` being `@unique`.
2. **One ledger row per stock change** and `SUM(delta) == currentStock` for every item at all times
   (`assertLedgerInvariant`). Under the warn-only stock rule `currentStock` **may go negative**; the
   invariant is about the ledger agreeing with the balance, not about a non-negative floor. The
   stock-race test pins exactly that: two 8-unit confirms against stock 10 leave `-6`.
3. **All-or-nothing.** Stock update, line status, ledger row, visit status and audit event live in one
   `db.$transaction`; the rollback test forces a unique violation and proves nothing persisted.
4. **Visit status is derived, never guessed.** After each confirm the service re-reads line statuses
   under lock and recalculates (`server/src/utils/visitStatus.ts`): no `PENDING` left and at least
   one `LOADED` → `READY_FOR_CHECKOUT`; some loaded, some pending → `PARTIALLY_LOADED`; nothing
   loaded → `AWAITING_LOADING`; all cancelled → `CANCELLED`.
5. **Checkout is strict.** `POST /checkout` refuses with `409 NOT_READY` while any line is pending; a
   duplicate checkout produces exactly one transition and one audit row.
6. **Shed scoping is server-side.** Confirm of a foreign shed's line is `403 CROSS_SHED`; item and
   dashboard reads are scoped the same way, fail-closed when the caller has no shed.
7. **How it is enforced:** pessimistic row locks — `SELECT … FOR UPDATE` in
   `server/src/utils/rowLocks.ts` (visit → line → item lock order) inside `db.$transaction`.
   `withDeadlockRetry()` (`server/src/utils/retry.ts`) wraps the `confirmLine` and `checkoutVisit`
   transactions and re-runs them **once** on Prisma `P2034`. The tests do not assert the retry path —
   two or three concurrent requests do not reliably provoke a deadlock.

---

## 6. What is manual only

Demo/acceptance checks that must be done by hand on the target tablets. The step-by-step list is in
[`docs/demo-script.md`](./demo-script.md); the tablet checklist is in
[`docs/05-demo-and-seed.md`](./05-demo-and-seed.md#9-tablet-checklist).

1. **PWA install, icons, splash** on the real Android/iPad browsers — home-screen add, cold launch,
   portrait and landscape. **Not done.**
2. **Service-worker update flow** — deploy a new build, confirm the "A new version is ready" prompt
   arms, "Reload now" reloads only after the tap, and nothing reloads mid-form. The worker waits on
   install and skips waiting only on `SKIP_WAITING`; `UpdatePrompt.tsx` reloads only when it asked
   to. **Not verified on a device.**
3. **Offline behaviour** — airplane mode: mutations blocked with a banner, lists show last-synced
   state, reconnect refetches without a reload. `client/public/offline.html` is the fallback page.
   **Not verified on a device.**
4. **Touch targets and keyboards** — ≥44 px targets, correct keyboard per field, negative quantity
   enterable on iOS for the signed adjustment. **Not verified on a device.**
5. **Multi-device live sync** — gate plus two shed tablets: a confirm on one board updates the other
   two within a second, and a shed never receives another shed's events. **No automated socket test
   either (§7.3).**
6. **The 3–5 vehicle demo run** — fresh seed, single-shed and multi-shed, over-stock to negative,
   then open the CSV and Excel exports in a spreadsheet to confirm filters and formula escaping.
   **Not run.**
7. **Session behaviour** — the token lives in memory only, so a cold PWA launch requires a relogin;
   token expiry on the socket logs the user out with a toast and does not loop reconnects. Documented
   behaviour, verified by reading the code, **not on a device**.

---

## 7. Open gaps

| # | Gap | Why it matters |
|---|---|---|
| 7.1 | **No CI.** There is no `.github/workflows`, no test job, no migrate-against-MySQL job anywhere in the repo. | Nothing runs typecheck, lint or the suite automatically; regressions are found by hand. |
| 7.2 | **No socket test.** Cross-shed denial is covered over REST only. Nothing verifies that a `shed:{code}` room receives `loading.confirmed`/`stock.updated`, that a shed cannot receive another shed's events, or that `session.expired` fires on token expiry. | The realtime layer — the main reason for this stack — is unverified. |
| 7.3 | **Device behaviour untested.** PWA install, service-worker update, offline cold launch, portrait/landscape, on-screen keyboards: manual checklist only, never executed. | The tablets are the delivery target. |
| 7.4 | **`checkout-race` asserts the loser by status only.** It requires one `200` and one `409` and one audit row, but does not pin the error code (unlike `concurrent-confirm`, which asserts `ALREADY_CONFIRMED`). | A different 409 cause would still pass. |
| 7.5 | **Race windows have no regression test.** `createVisit` reads items outside its transaction and `deleteItem` checks usage before archiving/deleting, so an item archived mid-registration or a line created mid-delete can slip through. `createVisit` retry duplication (the deadlock retry re-runs the whole operation) is also untested. | The "commit succeeded, response failed / duplicate on retry" class of bug is unpinned. |
| 7.6 | **Archived-item rules are only half pinned.** A pending line of an archived item is covered; `createVisit`'s `409 ITEM_INACTIVE` for a new line on an archived item is not. | A future change to either side passes silently. |
| 7.7 | **Factory fidelity.** Factories hash passwords with bcrypt cost `4` instead of production `12`, and items are created through the Prisma client rather than the HTTP API. | Real auth cost and the login → token → request path are exercised only indirectly. |
| 7.8 | **Last-admin protection is untested because it does not exist.** Disabling yourself is blocked and tested; disabling the last remaining admin is allowed and untested. | An operator can lock the deployment out of user management. |
| 7.9 | **Dependency advisories.** `npm audit --omit=dev` reports 5 advisories (3 high, 2 moderate) via Prisma's `deepmerge-ts` and ExcelJS's `uuid`; no non-breaking fix today. | Unpatched transitive packages run in the api image; nothing fails because of it in tests. |

Closed in this pass, listed so nobody re-checks them: tests are inside `tsconfig` include and
typechecked while the build excludes them; `setup-env.ts` sets a test-only `JWT_SECRET` and forces
`NODE_ENV=test`; `truncateAll()` refuses non-`_test` databases; `ledger-rollback` pins Prisma
`P2002`; `stock-race` pins the exact negative balance and two OUT rows instead of the old
`409 INSUFFICIENT_STOCK` expectation.

---

## 8. Target CI sequence

Not implemented (§7.1). Once it exists, this order fails fast and proves the loop:

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
export TEST_DATABASE_URL="mysql://dms:dms@127.0.0.1:3306/dms_test"

# 1. backend
cd server
npm ci
npx prisma generate
npm run typecheck                 # src + tests + prisma/seed.ts
npm run lint                      # biome check, 74 files
npm run build                     # tsc -p tsconfig.build.json, src only
npm test                          # vitest run; needs MySQL + dms_test

# 2. frontend
cd ../client
npm ci
npm run typecheck                 # tsc --noEmit
npm run lint                      # biome check, 69 files
npm run build                     # next build, standalone + build-time env
```

No `JWT_SECRET` export is needed for step 1 any more — `tests/setup-env.ts` supplies a test-only
value. Set it anyway if you also run anything else against the API in the same job.

Proposed job shape (GitHub Actions — not present in the repo):

```yaml
# .github/workflows/ci.yml  — proposed
name: ci
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mysql:
        image: mysql:8.4
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: dms_test
          MYSQL_USER: dms
          MYSQL_PASSWORD: dms
        ports: ["3306:3306"]
        options: >-
          --health-cmd="mysqladmin ping -h localhost"
          --health-interval=10s --health-timeout=5s --health-retries=10
    env:
      TEST_DATABASE_URL: mysql://dms:dms@127.0.0.1:3306/dms_test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm, cache-dependency-path: "*/package-lock.json" }
      - run: npm ci && npx prisma generate && npm run typecheck && npm run lint && npm run build && npm test
        working-directory: server
      - run: npm ci && npm run typecheck && npm run lint && npm run build
        working-directory: client
        env:
          NEXT_PUBLIC_API_URL: http://localhost:5000
          NEXT_PUBLIC_SOCKET_URL: http://localhost:5000
```

The MySQL service container creates `dms_test` itself (`MYSQL_DATABASE`), so no extra
`CREATE DATABASE` step is needed.

---

## 9. Verification status

- **`npm test` → 12 files, 40 tests, all pass** on `dms_test` (2026-10-30). Per-file counts are in §4.
- Server `npm run typecheck`, `npm run lint` (74 files) and `npm run build`: clean.
- Client `npm run typecheck`, `npm run lint` (69 files) and `npm run build` (Next 16.4.3,
  standalone): clean.
- No CI has ever run this suite; no Docker build, deployment or device check has exercised it.
