
# Phase 06 — Hardening + Public Demo Plan

Goal: secure public link, fresh DB → full demo passes. No new features, no data-model changes.

## 1. Findings (what exists today)

Backend (`server/src/`):

- `app.ts`: helmet defaults ✅, `cors({origin: single string})` ⚠️, `express.json()` no explicit limit ❌, no `trust proxy` ❌, no global limiter ❌.
- `middlewares/rateLimit.ts`: custom in-memory 10 req/60s per `ip:username`, login-only ⚠️ (unbounded Map, dies on restart, wrong IP behind proxy).
- `middlewares/errorHandler.ts`: already safe — ApiError/P2002/P2025 mapped, else 500 `INTERNAL_ERROR`, no stack leak ✅.
- `validators/*`: all write routes covered ✅, but strings mostly unbounded (`name/category/unit/vehicleNumber/driverName/party`), qty positive but no upper bound.
- `config/env.ts` + `index.ts`: only presence checks ❌ — weak `JWT_SECRET=change-me…` passes, no prod fail-fast.
- `prisma/seed.ts`: hardcoded `Password@123` ❌, `item.create()` loop duplicates on re-run ❌, no wipe mode ❌, synthetic data only ✅ (2 sheds, 10 items, no visits).

Frontend (`client/src/`):

- Shared `States.tsx` + toasts at all active call sites ✅.
- Gaps: `VehicleForm` items select (no pending/empty), `shed/page.tsx` shedsQuery silent fail, `ShedStock !shedCode → null` vs `IncomingQueue → EmptyState`, filter `<select>`s (`InventoryTable`, `LogsTable`) swallow aux-query failure, `AppShell` logout no toast.
- PWA: manifest + icons 192/512/maskable ✅, missing `apple-touch-icon-180` + `favicon.ico` ❌, `UpdatePrompt` never sends `SKIP_WAITING` / never calls `registration.update()` ❌, SW static fetch has no `.catch` ❌, no persisted query cache (accepted — offline = blocked mutations + stale labels, already implemented).

Tests / deploy:

- Zero tests, no runner ❌. DB is MySQL 8.4 (`FOR UPDATE` everywhere) — sqlite cannot be used.
- `docker-compose.yml`: mysql only ❌. No Dockerfiles, no healthchecks, no prod override.

## 2. Opinionated decisions (one approach, no over-engineering)

1. **Rate-limit: `express-rate-limit` (library), not Redis, not custom.** Taste = functional + simple. Two limiters in one new file `server/src/middlewares/limiters.ts`: `loginLimiter` (10/60s, `keyGenerator = ip+username`) + `apiLimiter` (300/60s per IP). `app.set("trust proxy", 1)`. Delete old `rateLimit.ts`.
2. **CORS stays exact-origin allowlist, bearer tokens stay (no cookie-session migration in Phase 06).** Parse `CORS_ORIGIN` as comma-separated list, `origin` callback rejects unknown, explicit `methods/allowedHeaders`, `credentials:false`. Same config reused for `socket.io`. Same-origin serve documented as deploy option, not implemented.
3. **JWT: pin algorithm + prod strength gate, no refresh/revocation in Phase 06.** `sign/verify` pin `HS256`; `assertProductionEnv()` throws in prod if `JWT_SECRET < 32 chars` or in denylist or `CORS_ORIGIN=*`.
4. **Zod: add `.max()` bounds only, no strict-mode migration.** Names ≤120, vehicle ≤20, reason ≤255 (exists), qty/loadedQty ≤1_000_000. Keeps existing `validate()` middleware untouched.
5. **Seed: env passwords + `--reset` wipe, idempotent default path.** `SEED_*_PASSWORD` (4 vars); required in prod, dev fallback warns. `npm run db:seed -- --reset` deletes in FK order in one txn, then reseeds. Non-reset path: sheds/users `upsert`, items `findFirst(shedId+name)` → skip or create (no duplicates). Never print passwords.
6. **Frontend: fill gaps only, no new offline queue, no persisted cache.** Offline stays "blocked mutations + stale labels + refetch on focus/reconnect" (already built). Just add missing pending/empty/error branches + logout toast.
7. **PWA: minimal surgical fixes.** Add `apple-touch-icon-180.png` + `favicon.ico`, wire `SKIP_WAITING` + `registration.update()` + `updatefound` listener + `controllerchange → reload`, add `.catch` fallback on static SW fetch. No screenshots/shortcuts/categories bloat. Splash re-verify is manual on tablet after shell change.
8. **Tests: `vitest + supertest` against real MySQL `dms_test`, no sqlite, no Redis.** 5 files under `server/tests/`. Requires `TEST_DATABASE_URL`; docs state MySQL must be running.
9. **Deploy: two Dockerfiles + compose extension, HTTPS left to platform LB.** `server/Dockerfile` (node:20-slim, `prisma generate` → build → `migrate deploy` entrypoint), `client/Dockerfile` (Next standalone), `docker-compose.yml` gains `api`/`web` + healthchecks + `depends_on`, plus `docker-compose.prod.yml` override. Region/HTTPS documented as env + platform notes (ap-south-1, managed MySQL, LB terminates TLS), not vendored infra.

Out of scope (explicitly deferred): Redis-backed limiting, JWT refresh/revocation, cookie sessions, offline mutation queue, strict-zod migration, infra-as-code for region/HTTPS.

## 3. Backend changes

| File                                                                    | Change                                                                                                                                                                                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/package.json`                                                 | add `express-rate-limit`, `vitest/supertest` dev deps; add `test`, `db:seed -- --reset` passthrough works as-is                                                                            |
| `server/src/middlewares/limiters.ts` (new, replaces `rateLimit.ts`) | `loginLimiter` + `apiLimiter` via `express-rate-limit`, `keyGenerator` for login includes username, `standardHeaders:true, legacyHeaders:false`                                          |
| `server/src/middlewares/rateLimit.ts`                                 | delete                                                                                                                                                                                             |
| `server/src/app.ts`                                                   | `app.set("trust proxy", 1)`; `express.json({limit:"100kb"})` + `urlencoded({limit:"100kb"})`; `apiLimiter` before routes, `loginLimiter` stays on login route; CORS via allowlist helper |
| `server/src/config/cors.ts` (new, single-responsibility)              | `parseOrigins(env.corsOrigin)` + `corsOptions` object shared by Express + `config/socket.ts`                                                                                                 |
| `server/src/config/socket.ts`                                         | reuse same origin callback                                                                                                                                                                         |
| `server/src/config/env.ts`                                            | add `assertProductionEnv()` (pure function, called from `index.ts`): JWT length/denylist, `CORS_ORIGIN != *`, seed-password presence when `SEEDING in prod`; keep `requireEnv`           |
| `server/src/index.ts`                                                 | call `assertProductionEnv()` before `listen()`; crash on throw                                                                                                                                 |
| `server/src/utils/jwt.ts`                                             | pin `algorithm:"HS256"` in sign/verify                                                                                                                                                           |
| `server/src/validators/*.ts`                                          | add `.max()` + qty upper bounds (item/visit/auth where applicable)                                                                                                                               |
| `server/prisma/seed.ts`                                               | env passwords + `--reset` wipe + idempotent items + `console.warn` in dev fallback; exit non-zero if prod passwords missing                                                                    |
| `server/.env.example`                                                 | document `CORS_ORIGIN` list format, `JWT_SECRET` ≥32 random, `TEST_DATABASE_URL`, `SEED_*_PASSWORD`                                                                                       |

Error handler: no change (already leak-free). Just cover it with a unit test (ZodError → 400 path via `validate` middleware if applicable).

## 4. Frontend changes

| File                                                                  | Change                                                                                                                                                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client/src/components/gate/VehicleForm.tsx`                        | items select: `isPending → "Loading items…"` disabled, `isError → retry text`, empty → `"No items"` disabled; keep existing toasts                   |
| `client/src/app/shed/page.tsx`                                      | `shedsQuery.isError → ErrorState + retry`; `isPending → LoadingState` in override box                                                                    |
| `client/src/components/shed/ShedStock.tsx`                          | `!shedCode → EmptyState` (match `IncomingQueue`)                                                                                                          |
| `client/src/components/admin/InventoryTable.tsx`, `LogsTable.tsx` | aux `useSheds/useItems` failure → inline `"Filters unavailable"` hint (don't block table)                                                                 |
| `client/src/components/layout/AppShell.tsx`                         | `toast.success("Signed out")` on logout                                                                                                                      |
| `client/public/icons/apple-touch-icon-180.png`, `favicon.ico`     | add (export from existing 512 source); `layout.tsx` icons reference 180                                                                                      |
| `client/src/components/pwa/UpdatePrompt.tsx`                        | call `registration.update()`, listen `updatefound`, `Reload now → postMessage({type:"SKIP_WAITING"})`; `controllerchange → window.location.reload()` |
| `client/public/sw.js`                                               | static cache-first fetch add `.catch(() => caches.match(OFFLINE_URL))`-style fallback for navigations only; bump `v2`                                      |

No query-provider persistence, no mutation queue.

## 5. Concurrency tests (real MySQL)

New `server/tests/` (single-responsibility files):

- `setup.ts` — reads `TEST_DATABASE_URL`, `migrate deploy` once, `truncate()` helper in FK order, per-test app instance via `createApp()`.
- `factories.ts` — `makeShed/makeItem/makeUser/makeVisitWithLines` via Prisma (pure helpers, no classes).
- `concurrent-confirm.test.ts` — two parallel `confirmLine` same line → exactly one 200, one 409 `ALREADY_CONFIRMED`, one `OUT` ledger row, `SUM(delta)==currentStock`.
- `stock-race.test.ts` — competing visits over same item, request > stock → no negative `currentStock`, losers get 409 `INSUFFICIENT_STOCK`, ledger sum invariant holds.
- `ledger-rollback.test.ts` — forced ledger failure (e.g. duplicate `requirementLineId @unique` via double-create mock or injected bad actor id) → item stock + line status unchanged.
- `checkout-race.test.ts` — duplicate checkout → one transition to `CHECKED_OUT`, one 409, single audit event.
- `cross-shed.test.ts` — SHED-A token confirming SHED-B line via API → 403 `CROSS_SHED`; socket join + emit from wrong shed → denied (assert no state change + error event).
- `ledger-invariant.test.ts` — after each suite, `SUM(delta) GROUP BY itemId == currentStock` for all items.

Multi-shed concurrent confirms covered inside `concurrent-confirm.test.ts` (two lines, different sheds, same visit → `PARTIALLY_LOADED` → `READY_FOR_CHECKOUT` final status assert).

Run: `TEST_DATABASE_URL=mysql://dms:dms@localhost:3306/dms_test npm test` (docs note: `dms_test` must exist; CI creates it).

## 6. Deploy

- `server/Dockerfile` (new): `node:20-slim` builder (`npm ci`, `prisma generate`, `npm run build`, `prune --omit=dev`) → runner (`migrate deploy && node dist/index.js`), `HEALTHCHECK /health`.
- `client/Dockerfile` (new): `node:20-slim` builder (`npm ci`, `npm run build` standalone) → runner (`node server.js`), `HEALTHCHECK /`.
- `client/next.config.ts`: `output:"standalone"` (verify no conflict with existing `sw.js` no-cache headers).
- `.dockerignore` (root + per-service as needed): `node_modules/.next/dist/.git`.
- `docker-compose.yml`: add `api` (build server, `env_file`, `DATABASE_URL=mysql://dms:dms@mysql:3306/dms`, `depends_on mysql healthy`, port 5000) + `web` (build client, `NEXT_PUBLIC_*`, port 3000); add mysql `healthcheck: mysqladmin ping`.
- `docker-compose.prod.yml` (new): `restart:always`, no ports for mysql, `${JWT_SECRET:?}`, `${CORS_ORIGIN:?}`, `${DATABASE_URL:?}` required, image tags.
- `docs/` note: India region = deploy host/LB in `ap-south-1`; HTTPS terminated at platform LB (required for PWA + cookies); managed MySQL URL format; demo passwords via secrets manager, never in image.

## 7. Acceptance mapping

- Fresh migrate + seed → scripted 3–5 vehicle demo: covered by `--reset` seed + `docs/demo-script.md` (new, short: 1 single-shed + 1 multi-shed vehicle flow with expected statuses).
- Cold PWA launch / relogin: existing session behavior documented in demo-script (token in memory → relogin required after cold start).
- Offline → blocked mutations, stale labels, reconnect refetch: already built; add `online → invalidateQueries` one-liner in `AppShell` if missing during implementation.
- SW update → prompt, no interrupted op: fixed `UpdatePrompt` (prompt only, never force-reload mid-mutation — `SKIP_WAITING` only on user click).
- CSV export filters/formula escape: verify existing `LogsTable` export escapes `=+-@` prefix (add test or fix if missing — check during implementation, default to prefixing with `'`).
- Tablet portrait/landscape, touch targets: manual checklist in demo-script (re-verify after shell change).

## 8. Execution order + checkpoint commits (per taste)

Taste requires root-level files first, then server setup vs src separately, then client, then docs — setup files separately from code files.

1. `chore(phase-06): root compose + dockerfiles + ignores` — `docker-compose.yml`, `docker-compose.prod.yml`, `server/Dockerfile`, `client/Dockerfile`, `.dockerignore`s.
2. `chore(server): phase-06 setup (deps + env + cors + limiters)` — `package.json`, `config/env.ts`, `config/cors.ts`, `middlewares/limiters.ts` (delete old), `app.ts` wiring, `.env.example`.
3. `feat(server): phase-06 seed reset + validator bounds + jwt pin` — `prisma/seed.ts`, `validators/*`, `utils/jwt.ts`, `index.ts` gate.
4. `test(server): phase-06 concurrency suite` — `tests/*` only.
5. `fix(client): phase-06 query states + logout toast` — `VehicleForm`, `shed/page`, `ShedStock`, `InventoryTable`, `LogsTable`, `AppShell`.
6. `fix(client): phase-06 pwa update + icons` — `public/*`, `sw.js`, `UpdatePrompt.tsx`, `layout.tsx`, `next.config.ts`.
7. `docs(phase-06): demo script + acceptance checklist` — `docs/demo-script.md` (new), update `docs/phases/phase-06-hardening-demo.md` checkboxes only.

Verify after each: `typecheck + lint + build` (server + client), `npm test` needs MySQL `dms_test` up.

## 9. Risks

- `express-rate-limit` behind LB needs `trust proxy:1` — set it, but document spoof risk if multiple proxies (single LB assumed).
- In-memory limiters reset on deploy restart — accepted for demo scale; Redis explicitly deferred.
- Parallel `confirmLine` test flakiness on slow CI — mitigate with `Promise.allSettled` + retry-once on deadlock (`P2034` → retry is success-path, not failure).
- Next standalone + custom `sw.js`: verify `/sw.js` still served with `no-cache` after standalone build; if broken, serve SW from `public/` via rewrites (fallback noted during implementation).
