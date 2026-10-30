# AGENTS.md — DMS POC

Instructions for anyone (human or agent) working in this repo.

## What this project is

Depot Management System (DMS) POC for **one ammunition depot**. It replaces phone calls and paper slips between the gate, the sheds and the office with three browser tablets that sync live. Roles: `ADMIN`, `GATE`, `SHED` (one login per shed). The loop: gate registers a vehicle + requirement lines → each line routes to the shed holding the item → shed confirms the actual loaded quantity → stock and an append-only ledger update → gate checks out once every shed has finished. One vehicle may need items from two sheds.

Stack: Next.js 16 PWA client + Express 5 / Prisma 6 / MySQL 8.4 server, Socket.IO invalidation hints, JWT auth. Details in `techstack.md`.

**The tree is dirty on purpose.** Everything from the 2026-10-30 hardening pass — the review's four blockers, shed scoping, the users module, Excel export, socket-expiry logout, test hygiene — is **uncommitted working-tree change**. `typecheck`, `lint`, both builds and 40/40 MySQL tests are green on it. Nothing is committed; do not `git commit` as part of a task.

## Read order — do this before changing anything

1. `docs/decisions_made.md` — **authoritative** on what the system must do (statuses, stock rule, item editing, users, export, auth, realtime, deploy).
2. `docs/project-status.md` — **authoritative** on what actually works, the state of each review blocker, the still-open list, and what is unverified. This page is the fastest way to avoid re-doing or contradicting work.
3. `techstack.md` — versions and deliberate non-choices.
4. Only then the phase docs in `docs/phases/` (they are plans and records, not current truth).
5. `docs/specs_document.md` is **historical** — it predates the decisions and still shows an old status chain and old ledger fields. Never implement from it.

If code and `docs/decisions_made.md` disagree, the decision file is the target and `docs/project-status.md` should be listing the gap. If the gap is not listed, add it there instead of silently "fixing" the doc.

## Repo layout

```
rit/
├─ agents.md                 # this file (root instructions)
├─ techstack.md              # stack + non-choices
├─ readme.md                 # short entry point
├─ docker-compose.yml        # dev: mysql 8.4 + api + web
├─ docker-compose.prod.yml   # self-contained production stack (not an override)
├─ docs/
│  ├─ decisions_made.md      # AUTHORITATIVE — target behaviour
│  ├─ project-status.md      # AUTHORITATIVE — current state, blockers, verification
│  ├─ demo-script.md         # demo run sheet (follows the warn-only stock rule)
│  ├─ specs_document.md      # historical concept (superseded)
│  └─ phases/                # phase-01 … phase-06 plans + records
├─ server/
│  ├─ prisma/schema.prisma   # models, enums (visit/line statuses live here)
│  ├─ prisma/seed.ts         # 2 sheds, ~10 items, 4 users; --reset flag
│  ├─ src/app.ts             # express app wiring (mounts /api/*)
│  ├─ src/index.ts           # boot, socket attach, graceful shutdown
│  ├─ src/config/            # env, db, cors, socket
│  ├─ src/middlewares/       # auth, requireRole, validate, limiters, errorHandler
│  ├─ src/modules/<name>/    # <name>.routes.ts → .controller.ts → .service.ts
│  ├─ src/validators/        # zod schemas per module
│  ├─ src/utils/             # responses, errors, jwt, password, rowLocks, retry, csv, datetime…
│  └─ tests/                 # vitest + supertest against real MySQL dms_test (12 files / 40 tests)
└─ client/
   ├─ src/app/               # routes: /login, /gate, /shed, /admin, layout, manifest
   ├─ src/components/        # by role/feature: gate/, shed/, admin/, common/, layout/, pwa/, ui/
   ├─ src/hooks/             # useVisits, useItems, useLogs, useDashboard, useShedQueue, useSocket…
   ├─ src/services/          # thin fetch wrappers per module
   ├─ src/providers/         # auth-provider, socket-provider, query-provider
   ├─ src/lib/               # api-client, socket-client, query-keys, errors, utils
   ├─ src/validations/       # client zod schemas (mirror server validators)
   └─ public/                # sw.js, offline.html, icons
```

## Backend conventions

- **Flow is fixed:** `route → controller → service → Prisma`. Routes do auth + role + validation wiring only. Controllers parse the validated input and shape the response. Services hold logic and transactions. No Prisma calls in controllers or routes.
- **Files by module and responsibility.** A new feature is a new `src/modules/<name>/` with routes/controller/service (+ `*.dto.ts` where mapping is non-trivial), a `src/validators/<name>.schemas.ts`, and registration in `src/app.ts`.
- **Functional style.** No classes, no OOP hierarchies. The single class in the server is `ApiError` (`src/utils/errors.ts`) — reuse it, do not add more.
- **Zod at every boundary.** Body/query/params go through `validate` / `validateQuery`; services receive typed input (`z.infer`) and never trust raw `req`.
- **Response shape is frozen:** `{ data }` for success (`ok`), `{ data, pagination }` for paginated lists (`okPaginated`), `{ error: { code, message } }` for failures (`fail` / `ApiError`). Codes are SCREAMING_SNAKE strings (`INVALID_QTY`, `ALREADY_CONFIRMED`, `CROSS_SHED`, `ITEM_NOT_FOUND`); the client matches on `code`, not message.
- **Ledger invariant:** stock is never written without a ledger row. Every stock change (opening, stock-in, adjust, confirm → `OUT`) runs inside `db.$transaction` together with its `stockLedger` write, and `SUM(ledger.delta) == item.currentStock` must hold. Use the row-lock helpers in `src/utils/rowLocks.ts` for any path that reads-then-writes stock. Never update `item.currentStock` directly.
- **Statuses are enums:** visit `AWAITING_LOADING | PARTIALLY_LOADED | READY_FOR_CHECKOUT | CHECKED_OUT | CANCELLED`, line `PENDING | LOADED | CANCELLED`. Recalculate with `src/utils/visitStatus.ts`; do not hardcode strings in new code.
- **Shed scoping is server-side.** Any read that a `SHED` user can call must filter to the caller's shed from the token; a missing shed claim must fail closed (403 `CROSS_SHED`), never fall open. Client role checks are UX only. `GET /api/items` and `GET /api/dashboard` are scoped this way today — keep any new SHED-readable route in line.
- **Logging/errors:** no secrets, tokens, passwords, or full request bodies in logs. Auth/DB failures map through `src/middlewares/errorHandler.ts`; add cases there rather than leaking 500s.

## Frontend conventions

- **Server state belongs to TanStack Query.** Keys are centralised in `src/lib/query-keys.ts`; mutations invalidate keys, they do not hand-patch caches. Socket events are invalidation hints only — the HTTP response is the truth.
- **Client state is context only** (`auth-provider` for token/user, `socket-provider` for the connection). No Redux/Zustand.
- **Token in memory only** (never `localStorage`/`sessionStorage`). A refresh means relogin — that is intended.
- **Fetching goes through** `src/lib/api-client.ts` + a module wrapper in `src/services/`. Do not call `fetch` from components.
- **Components by role/feature** (`components/gate`, `components/shed`, `components/admin`), shared bits in `components/common` and primitives in `components/ui`. Functional components, no classes, no memoisation ceremony (React Compiler is on).
- **Validate forms with zod** in `src/validations/`, mirroring the server schemas; the server is still the only authority.
- **Tablet-first UI:** large touch targets, portrait and landscape, visible offline/stale state, no destructive action without confirmation.

## Commands

Always put the project Node on PATH first:

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
```

| Task | Command |
|---|---|
| Install deps | `cd server && npm install` · `cd client && npm install` |
| Database up | `docker compose up -d mysql` (MySQL 8.4 on 127.0.0.1:3306, db `dms`) |
| Migrate | `cd server && npm run db:migrate` (= `prisma migrate dev`) |
| Seed | `cd server && npm run db:seed` · reset: `npm run db:seed -- --reset` (usernames `admin`, `gate`, `sheda`, `shedb`; passwords from `SEED_*_PASSWORD`, else dev fallbacks) |
| Server dev | `cd server && npm run dev` (tsx watch, http://localhost:5000, health at `/health`) |
| Client dev | `cd client && npm run dev` (http://localhost:3000) |
| Typecheck | `cd server && npm run typecheck` · `cd client && npm run typecheck` (both are `tsc --noEmit`; the server's covers `tests/` too) |
| Lint / format | `cd server && npm run lint` · `cd client && npm run lint` (Biome) · `npm run format` to write |
| Tests (server only) | `cd server && TEST_DATABASE_URL="mysql://dms:dms@127.0.0.1:3306/dms_test" npm test` — needs MySQL up and a `dms_test` database; `tests/setup-env.ts` sets `DATABASE_URL` from `TEST_DATABASE_URL`, defaults `JWT_SECRET`, and the suite refuses to truncate any database whose name does not end in `_test`. Green run: 12 files / 40 tests |
| Build | `cd server && npm run build` (→ `dist/index.js`) · `cd client && npm run build` (→ `.next/standalone/server.js`) |
| Full stack | `docker compose up --build` (dev) · `docker compose -f docker-compose.prod.yml up -d --build` (self-contained; needs all prod secrets; never built in this repo so far) |

Run `typecheck` and `lint` in every package you touched. Do not start long-running servers, run Docker builds, or run migrations/tests unless the task needs them.

## Rules

- **Update the docs with the behaviour.** A change to rules, statuses, API shape, or what actually works updates `docs/decisions_made.md` and/or `docs/project-status.md` in the same change. Never leave a doc claiming a broken feature works.
- **No classes / no OOP**, no over-engineering, one responsibility per file, match existing formatting (Biome, 4 spaces, double quotes, semicolons).
- **No comments** unless the logic genuinely is not self-evident.
- **Never log secrets** — no tokens, passwords, `DATABASE_URL`, `JWT_SECRET`, or `SEED_*` values in code, logs, fixtures or docs.
- **Do not commit or push unless asked.** No `git commit`, no history rewriting, no branch surgery.
- **Don't invent scope.** User management and `.xlsx` export are agreed **and built**; the dashboard current-stock list, offline queues, refresh tokens, Redis and native apps are out of scope (`techstack.md`).
- **Don't touch other people's files** in a multi-agent pass; stay inside the files your task assigns.
- **Secrets in prod:** `JWT_SECRET` (32+ chars) and an explicit `CORS_ORIGIN` allowlist are required to boot; the seed additionally requires all four `SEED_*_PASSWORD` values when it runs in production. Never log them or bake them into images.

## Doc map

| File | Role |
|---|---|
| `docs/decisions_made.md` | **Authoritative** decision log: what the product must do and why, plus known deviations |
| `docs/project-status.md` | **Authoritative** status: what works, state of each review blocker, still-open issues, verification performed/not performed, next order |
| `techstack.md` | Layers, exact versions, why each, explicit non-choices |
| `agents.md` | This file — how to work here |
| `server/agents.md`, `client/agents.md` | Package-specific notes |
| `docs/phases/phase-0*.md` | Historical plans/records per phase (not current truth; the phase-06 checklist overstates what is proven) |
| `docs/00-product-scope.md` … `docs/07-testing.md` | Reference set written in the same pass: scope, architecture, data model, API contract, setup/env, demo/seed, deploy, testing. Useful, but subordinate to the two authoritative files above |
| `docs/demo-script.md` | Demo run sheet (follows the warn-only rule) |
| `docs/specs_document.md` | Historical concept document — superseded, do not implement from it |
