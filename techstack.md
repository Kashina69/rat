# Tech Stack — DMS POC

What the project actually runs on, and why. Versions are copied from `server/package.json`, `client/package.json` and the Dockerfiles (2026-10-30). Target behaviour lives in `docs/decisions_made.md`; current gaps live in `docs/project-status.md`.

## Layers at a glance

| Layer | Technology | Version |
|---|---|---|
| Runtime | Node.js (local shell / images) | v22.23.2 locally; `node:20-slim` in Docker; server `engines.node >= 20` |
| Language | TypeScript, `strict: true` | server `^5.7.2`, client `^5` |
| Frontend | Next.js App Router PWA | `16.4.3` |
| UI runtime | React / React DOM | `19.3.0` (exact) |
| Styling | Tailwind CSS + Tailwind Turbopack loader | `^4` |
| Client data | TanStack Query | `^5.105.0` |
| Backend | Express | `^5.3.0` |
| API modules | `auth`, `visits` (+ `requirement-lines`), `sheds`, `items`, `logs`, `dashboard`, `users` | — |
| ORM | Prisma / `@prisma/client` | `^6.19.3` |
| Database | MySQL (Docker image) | `8.4` |
| Realtime | Socket.IO server / client | `^4.8.4` / `^4.8.4` |
| Validation | Zod (both sides) | `^4.6.7` |
| Auth | jsonwebtoken + bcryptjs | `^9.0.3` + `^3.0.3` |
| Excel export | exceljs | `^4.4.0` |
| HTTP hardening | helmet, cors, express-rate-limit | `^8.1.0`, `^2.8.5`, `^8.7.2` |
| Config | dotenv | `^16.4.5` |
| Tests | Vitest + Supertest (real MySQL `dms_test`) | `^5.0.5` + `^7.3.1` |
| Lint / format | Biome (per package, plus `tsc --noEmit`) | `^2.4.2` server, `2.4.2` client |
| Dev runner | tsx watch | `^4.19.2` |
| Deploy | Docker Compose: dev compose + self-contained production compose | `mysql:8.4`, `node:20-slim` |

## Why each

**Node 22 locally, Node 20 in images.** Local tooling runs on `v22.23.2` (`export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH`). Images pin `node:20-slim` because that is what the Dockerfiles were written against and the server declares `engines.node >= 20`. Consequence: local checks are not proof of runtime behaviour under Node 20; keep the image Node version in mind when using newer APIs.

**TypeScript strict, no build-time transpile tricks.** Server compiles with `tsc -p tsconfig.build.json` to `dist/` (entry `dist/index.js`); dev uses `tsx watch`. Client uses Next's own compiler and `npm run typecheck` (`tsc --noEmit`) for checking.

**Next.js 16 App Router as the PWA.** One codebase, three role screens on tablets, installed to the home screen. Next 16 features in use: `output: "standalone"` for the Docker image, built-in `manifest.ts`, `cacheComponents`, `partialPrefetching`, React Compiler, and a hand-written service worker (`client/public/sw.js`) instead of `next-pwa`. Rationale: install-ability without an app-store release, and no extra plugin layer. Note: `NEXT_PUBLIC_*` are inlined at build time, which is exactly why the prod image must receive them as build args.

**React 19.3 + React Compiler.** Modern concurrent React with the compiler enabled (`babel-plugin-react-compiler` 1.0.0) so components stay plain functions; no memoisation ceremony.

**Tailwind 4 + shadcn-style components.** Tailwind 4 via `@tailwindcss/turbopack`, with local shadcn-style primitives in `client/src/components/ui/` (Radix dialog `^1.3.1`, slot `^1.5.0`, `class-variance-authority` `^0.7.1`, `clsx` `^2.1.1`, `tailwind-merge` `^3.7.0`, `lucide-react` `^1.64.0`). Rationale: large touch targets on tablets, no component-library lock-in, no theme system to maintain.

**TanStack Query for all server state.** `^5.105.0`, with query keys centralised in `client/src/lib/query-keys.ts`. With Socket.IO invalidation hints this gives refetch-on-event and refetch-on-reconnect without hand-rolled caching. Auth and socket live in React context (`client/src/providers/`); no Zustand/Redux.

**React Hook Form + Zod on the client.** `react-hook-form` `^7.91.0` with `@hookform/resolvers` `^6.0.2` and `zod` `^4.6.7`, mirroring the server validators in `client/src/validations/`. Same Zod major on both sides keeps error shapes predictable.

**Express 5 + Prisma 6 + MySQL 8.4.** Express 5 is the current stable line with native async error propagation, so handlers stay thin. Prisma for typed queries, migrations and transactions — stock paths depend on `$transaction` with `SELECT … FOR UPDATE` row locks (`server/src/utils/rowLocks.ts`). MySQL 8.4 is a deliberate deviation from the concept's PostgreSQL (see decisions §2): depot-side familiarity and the demo host. The cost is losing Postgres-only features; nothing in the POC needs them.

**Zod on the server at every input boundary.** `^4.6.7`, wired through `validate` / `validateQuery` middlewares. One validation layer for body, query and params, so controllers never see raw input.

**JWT + bcryptjs, no session store.** `jsonwebtoken` `^9.0.3`, `bcryptjs` `^3.0.3` at 12 rounds. bcryptjs rather than native `bcrypt` deliberately: no native build step in Docker or on a fresh laptop, and 12 rounds is fast enough at this scale. Access-only tokens (~8h), no refresh/revocation — see decisions §9.

**Socket.IO 4.8.** Rooms per shed plus `gate` and `admin`. Chosen over polling/SSE for reconnection and room semantics on flaky tablet Wi-Fi. Events are hints, not state.

**helmet + cors allowlist + express-rate-limit.** `helmet ^8.1.0`, `cors ^2.8.5` with an explicit origin list (`server/src/config/cors.ts`), `express-rate-limit ^8.7.2` for a broad `/api` limiter plus a tighter login limiter. Cheap, no external service.

**Vitest + Supertest against a real MySQL `dms_test` database.** `vitest ^5.0.5`, `supertest ^7.3.1`. Stock correctness is about row locks and transactions; mocking Prisma would test the mock. The suite is 12 files / 40 tests and passes on `dms_test`; it needs `TEST_DATABASE_URL` (nothing else — `tests/setup-env.ts` defaults `JWT_SECRET` and refuses a database whose name does not end in `_test`). `server/tsconfig.json` includes `src`, `tests` and `prisma/seed.ts`, so `npm run typecheck` covers the tests too. Cost: tests need MySQL up by hand, and they are not in CI (none exists).

**exceljs for the `.xlsx` export.** `exceljs ^4.4.0`, used only in `server/src/modules/logs/logs.service.ts` behind `GET /api/logs/export.xlsx`. Chosen because it writes real `.xlsx` with number/date cells and column widths without a native or office dependency. The CSV path stays hand-rolled (`src/utils/csv.ts`) so its BOM and formula neutralisation are auditable; both formats share one query and filter set.

**Users module.** `server/src/modules/users/` + the admin Users screen. Enable/disable is a boolean on the user record (`isActive`), checked on login and on every authenticated request. No roles/permissions system beyond `ADMIN`/`GATE`/`SHED`: provisioning a handful of depot staff does not justify one, and self-signup stays out of scope.

**Biome + `tsc --noEmit`, Docker Compose.** Biome `^2.4.2` per package as the single lint+format tool (no ESLint/Prettier config to reconcile). Compose for dev (`docker-compose.yml`, `mysql` + `api` + `web`) and a **self-contained** production stack (`docker-compose.prod.yml`, its own three services — not an override), both on `mysql:8.4`. The current tree passes `typecheck`, `lint` and `build` on both sides; no image has been built yet.

**Known dependency advisories.** `npm audit --omit=dev` reports 5 advisories (3 high, 2 moderate) in `server/`. They come from transitive dependencies of Prisma (`deepmerge-ts`) and ExcelJS (`uuid`), not from application code, and there is no non-breaking upgrade path today. Tracked in `docs/project-status.md`; do not "fix" it by pinning a breaking major without testing.

## Deliberate non-choices

| Not used | Why not |
|---|---|
| **PostgreSQL** | Concept's original pick; replaced by MySQL 8.4 by user decision. No Postgres compatibility layer exists — do not write Postgres-only SQL |
| **Redis / BullMQ / any queue** | Single API instance, single depot. Stock writes must be synchronous and transactional anyway. Adding Redis would add a failure mode without removing work |
| **Refresh tokens / revocation store / session table** | Token-in-memory, 8h shift, physically controlled tablets. Relogin on refresh is accepted. Revocation would need server state the POC deliberately does not have |
| **Offline mutation queue / Background Sync** | Offline means "read the last data, block writes, show stale". A queue would need conflict resolution against stock, which is out of scope. `client/public/offline.html` and the connection badge exist for this reason |
| **Native app (React Native / Flutter)** | Installable PWA covers tablets, updates without store review, one codebase. No app-store release for the POC |
| **`next-pwa` / Workbox build plugin** | Next 16 gives the manifest; the service worker is 60 lines and hand-written so its caching rules can be audited (no API/auth data cached). A plugin would hide exactly what needs reviewing |
| **Socket-delivered state / client-side stores** | Realtime is invalidation only; REST is the source of truth. Avoids merge logic and stale-state bugs on reconnect |
| **Zustand / Redux / MobX** | Auth + socket context plus TanStack Query cover all client state. Add a store only if context demonstrably outgrows the POC |
| **ESLint + Prettier** | Biome does both, faster, one config per package |
| **Prisma alternatives (Drizzle, TypeORM, raw SQL)** | Prisma's typed client and migration history are already in place; raw SQL is used only where row locks need it |
| **CI pipeline** | Not set up. Consequence: `typecheck`/`lint`/tests are run by hand and nothing blocks a broken commit |
| **Error tracking / log aggregation / metrics** | Out of POC scope. Failures are visible via container logs only |
