# 06 — Testing

> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

An integration suite against a **real MySQL 8.4 database** (no sqlite, no mocks), with factories and a
ledger-invariant checker. **2026-10-30: 12 files, 40 tests, all passing.** No CI runs it; realtime, PWA
and tablets are manual-only. Create `rat_test` first — @docs/04-setup-and-deploy.md §6.

## 1. Stack

| Piece    | What it is                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Runner   | Vitest (`npm test` = `vitest run`) — `server/vitest.config.ts`: node env, `tests/setup-env.ts`, `testTimeout: 30_000`, `fileParallelism: false` |
| HTTP     | Supertest against `createApp()` — the real Express app, no listening socket                                                                               |
| Database | Real MySQL 8.4, schema `rat_test`, tables created by `prisma migrate deploy`                                                                             |
| Fixtures | `server/tests/factories.ts`: `makeShed`, `makeUser`, `makeItem` (with its `OPENING` row), `makeVisitWithLines`                                   |

`truncateAll()` runs before every test and files never overlap. Tests are typechecked: `tsconfig.json`
includes `tests/`, `tsconfig.build.json` excludes them.

## 2. How to run

```bash
TEST_DATABASE_URL=mysql://rat:rat@127.0.0.1:3306/rat_test npm test
```

That exact command produced §3. `tests/setup-env.ts` requires `TEST_DATABASE_URL`, copies it into
`DATABASE_URL`, forces `NODE_ENV=test` and supplies a test-only `JWT_SECRET`, so no `server/.env` is
needed; `migrateTestDb()` migrates once per run; `truncateAll()` **refuses any database whose name does
not end in `_test`**, so a mistyped URL aborts instead of wiping `rat`. One file or test:
`npx vitest run tests/checkout-race.test.ts`, `npx vitest run -t "duplicate checkout"`. Bare `npx vitest`
is watch mode and `npm test` is one destructive run — never point it at `rat`.

## 3. Result and per-file coverage

Last full run: **12 files, 40 tests, all pass** — `rat_test`, MySQL 8.4, Node 22.23.2.

| File                           |        Tests | What it asserts                                                                                                                                                                                                                                                                                                             |
| ------------------------------ | -----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `users.test.ts`              |            8 | No `passwordHash` in responses; duplicate username `409 DUPLICATE`; `SHED` needs a shed and other roles forbid one; disabled user gets `401` and a pre-existing token `403 ACCOUNT_DISABLED`; admin reset changes the login; `409 CANNOT_DISABLE_SELF`; role/shed stay consistent on update; non-admin `403`. |
| `csv.test.ts`                |            7 | Pure `toCsv` unit tests: quoting, doubled quotes, `=`/`+`/`-`/`@` and tab/control-character neutralisation, negative numbers, CRLF.                                                                                                                                                                               |
| `logs-date.test.ts`          |            5 | `YYYY-MM-DD` → IST day bounds (month/year/leap edges); non-dates fall back to instant parsing; a line at the IST boundary lands in that day; `GET /api/logs` applies `from`/`to`.                                                                                                                                  |
| `logs-export-xlsx.test.ts`   |            4 | ADMIN-only `.xlsx` export; headers, bold header, frozen row; rows keep CSV order; formula-like values stay text; same filters as CSV.                                                                                                                                                                                     |
| `stock-race.test.ts`         |            4 | Two confirms of 8 against stock 10 → both `200`, stock `-6`, two `-8` OUT rows, invariant holds; over-stock confirm deducts and writes one OUT row; `loadedQty > requested` → `400` with no deduction; a pending line of an archived item still confirms.                                                       |
| `item-scoping.test.ts`       |            3 | SHED lists only its own items; another shed's items `403 CROSS_SHED`; `GET /api/dashboard` is shed-scoped.                                                                                                                                                                                                              |
| `concurrent-confirm.test.ts` |            2 | Same line twice → one `200`, one `409 ALREADY_CONFIRMED`, stock `100 → 90`, exactly one OUT row; two sheds confirming their own lines → both `200`, visit `READY_FOR_CHECKOUT`.                                                                                                                                |
| `item-history.test.ts`       |            2 | Rename/recategorise after stock history write an audit row; a zero adjustment is rejected and never reaches the ledger.                                                                                                                                                                                                     |
| `ledger-invariant.test.ts`   |            2 | `SUM(delta) == currentStock` after stock-in, confirm and adjust; the scan catches drift on an unnamed item.                                                                                                                                                                                                               |
| `cross-shed.test.ts`         |            1 | Shed A confirming Shed B's line over HTTP → `403 CROSS_SHED`, line still `PENDING`, stock unchanged (REST only).                                                                                                                                                                                                       |
| `checkout-race.test.ts`      |            1 | Two simultaneous checkouts → one `200`, one `409`, status `CHECKED_OUT`, exactly one `VISIT_CHECKOUT` audit row.                                                                                                                                                                                                   |
| `ledger-rollback.test.ts`    |            1 | A pre-inserted OUT row on the same `requirementLineId` (`@unique`) makes the confirm fail `P2002`; stock stays `50`, line `PENDING`, nothing persisted.                                                                                                                                                           |
| **Total**                | **40** | —                                                                                                                                                                                                                                                                                                                          |

## 4. Invariants the suite protects

- **One line, one deduction:** the second confirm gets `409 ALREADY_CONFIRMED` and changes nothing —
  row lock plus status check, backed by `stock_ledger.requirementLineId` being `@unique`.
- **One ledger row per change**, `SUM(delta) == currentStock` at all times. Under the warn-only stock
  rule the balance **may go negative**; `stock-race` pins `-6`.
- **All-or-nothing:** stock, line status, ledger row, visit status and audit event share one
  `db.$transaction`; `ledger-rollback` proves nothing persisted after a forced unique violation.
- **Visit status is derived** (`server/src/utils/visitStatus.ts`), checkout is strict (`409 NOT_READY`
  while a line is pending), and shed scoping is fail-closed (`403 CROSS_SHED`).
- **Enforcement:** `SELECT … FOR UPDATE` in `server/src/utils/rowLocks.ts` (visit → line → item) inside
  `db.$transaction`; `withDeadlockRetry()` re-runs once on Prisma `P2034` — no test asserts that path.

## 5. Manual only (not automated)

PWA install/icons/splash on real tablets; service-worker update prompt (`UpdatePrompt.tsx`); offline
banner and reconnect without reload; touch targets and keyboards; multi-device live sync (gate plus two
sheds); the 3–5 vehicle demo run including CSV/Excel inspection in a spreadsheet; cold-launch relogin
and socket `session.expired` logout. Steps: @docs/05-demo-and-seed.md.

## 6. Open gaps

No CI, no socket test and no device test. Current list: `@docs/project-status.md` (Still open).
Testing-specific: `checkout-race` pins the status but not the error code; the `createVisit`/`deleteItem`
race windows and last-admin protection are untested.

## 7. Verification status

- `npm test` → 12 files, 40 tests, **40/40 pass** on `rat_test` (2026-10-30).
- Server and client `typecheck`, `lint` (74 / 69 files) and `build` clean; Next 16.4.3 standalone.
- No CI, Docker build, deployment or device check has exercised the suite.

Related: @docs/04-setup-and-deploy.md, @docs/02-data-model.md, @docs/03-api-contract.md, @docs/05-demo-and-seed.md
