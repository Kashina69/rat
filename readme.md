# DMS Depot — Depot Management System (POC)

A proof of concept for one ammunition depot. It replaces phone calls and paper
slips between the gate, the storage sheds, and the office with three browser
tablets that update each other live. Nothing is installed from an app store —
each tablet opens the web app and can add it to its home screen.

> **Status (2026-10-30).** The four blockers and the main majors from the review
> are **fixed in the working tree**: the production API no longer demands
> `SEED_*` passwords just to boot, the production web image receives
> `NEXT_PUBLIC_*` as build args, inventory rename/category edit works after
> stock history, and the PWA update prompt arms properly. The full server suite
> passes against MySQL `dms_test` — **12 files / 40 tests, all green** — and both
> packages typecheck, lint and build (server `dist/index.js`,
> client `.next/standalone/server.js`).
>
> **Not verified:** no Docker build or `docker compose up`, no production
> deployment, HTTPS or public link, no tablet installation, no
> portrait/landscape/offline/service-worker-update device test, and no 3–5
> vehicle demo run. Everything above is **uncommitted working-tree change**.
>
> Read **`docs/project-status.md`** for the honest list and
> **`docs/decisions_made.md`** for the target behaviour. Those two pages are
> authoritative.

## Three roles, one loop

| Role | Who | Does |
| --- | --- | --- |
| `ADMIN` | depot officer | inventory, every vehicle, logs, CSV + Excel export, users |
| `GATE` | gate security / clerk | register arriving vehicle + requirement, check out |
| `SHED` | storekeeper, one login per shed | incoming queue, confirm loaded quantity, own stock |

One loop: the gate registers a vehicle with item lines → each line routes to the
shed that holds the item and that shed is alerted → the shed confirms what was
actually loaded → stock and the ledger update → the gate checks out, allowed
only after every shed has finished. A vehicle can need items from two sheds;
each shed confirms its own lines.

Stage names used everywhere in this repo:

- Visit: `AWAITING_LOADING` → `PARTIALLY_LOADED` → `READY_FOR_CHECKOUT` → `CHECKED_OUT`, or `CANCELLED` before checkout.
- Requirement line: `PENDING` → `LOADED`, or `CANCELLED`.

Stock rule in force: short stock is a **warning only**. The gate is warned when
requesting more than recorded stock and can still save. Confirming a load has no
on-hand stock check, so recorded stock can go negative. Loaded quantity must
still be between 1 and the requested quantity. Checkout stays strict.

## What the app does today

| Area | State |
| --- | --- |
| Role login, in-memory JWT, bcrypt 12 rounds, disabled accounts rejected | Works |
| Gate: register vehicle + lines, short-stock warning, inside list, strict checkout | Works |
| Shed: own queue, confirm loaded qty, own stock, live updates | Works |
| Stock: ledger per change, stock-in, signed adjust, archive | Works |
| Logs: filters, IST-day date range, pagination, `GET /api/logs/export` (CSV) and `GET /api/logs/export.xlsx` (Excel, exceljs) | Works |
| Users (admin): list, create, edit role/shed, enable/disable, reset password | Works |
| Dashboard: vehicles inside, pending lines per shed, low stock | Works — low stock only, no full per-shed stock list |
| PWA: manifest, icons, offline page, install button, gated update prompt | Works in the browser; no device test |
| Deploy: Dockerfiles + standalone production compose | Configured, never built or run |

## Stack

| Layer | Choice |
| --- | --- |
| Web (tablets) | Next.js 16.4.3 PWA, React 19.3, Tailwind 4, TanStack Query, Socket.IO client, shadcn-style components, Sonner |
| API | Express 5, TypeScript strict, Prisma 6, Socket.IO, Zod, JWT (HS256), bcrypt (12 rounds), exceljs 4.4.0 |
| Database | MySQL 8.4 (concept doc proposed PostgreSQL; MySQL is the decision) |
| Tests | Vitest + Supertest against a real MySQL `dms_test` database |
| Tooling | Biome, `tsc --noEmit`, Docker Compose |

Version details and the deliberate non-choices: `techstack.md`.

## Quickstart (local)

Requirements: Node 20+ (developed on Node 22), npm, Docker. Put the project
Node on PATH first:

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
```

```bash
# 1. MySQL 8.4 on localhost:3306 (db dms, user dms / dms)
docker compose up -d mysql

# 2. Environment files
cp server/.env.example server/.env
cp client/.env.example client/.env.local
#    then set a long random JWT_SECRET (32+ chars) in server/.env

# 3. Install
(cd server && npm install)
(cd client && npm install)

# 4. Schema + demo data
cd server
npx prisma migrate deploy
npm run db:seed            # add `-- --reset` to wipe and reseed

# 5. API + Socket.IO on http://localhost:5000
npm run dev

# 6. Web app on http://localhost:3000 (second terminal)
cd client
npm run dev
```

Check the API is up: `curl http://localhost:5000/health`.
`client/.env.local` needs `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL`
(both `http://localhost:5000` by default). Next.js bakes these at build time, so
they are build args in Docker, not runtime env.

### Tests

The server suite is integration-only and needs its own throwaway MySQL schema.
Create `dms_test` once, then:

```bash
cd server
TEST_DATABASE_URL="mysql://dms:dms@127.0.0.1:3306/dms_test" npm test
```

Expected result on a clean `dms_test`: **12 files, 40 tests, all passing**
(users 8, logs-export-xlsx 4, stock-race 4, logs-date 5, item-scoping 3,
concurrent-confirm 2, item-history 2, ledger-invariant 2, cross-shed 1,
checkout-race 1, ledger-rollback 1, csv 7). `tests/setup-env.ts` sets
`DATABASE_URL` from `TEST_DATABASE_URL`, defaults `JWT_SECRET` for tests, and
refuses to truncate any database whose name does not end in `_test`. Migrations
are applied by the suite itself.

### Demo logins (local seed)

These are the development fallbacks; the `SEED_*_PASSWORD` env vars override
them. Users are seeded with these exact lowercase usernames.

| Username | Password | Role | Shed |
| --- | --- | --- | --- |
| `admin` | `Admin@123-dev-only` | `ADMIN` | — |
| `gate` | `Gate@123-dev-only` | `GATE` | — |
| `sheda` | `ShedA@123-dev-only` | `SHED` | `SHED-A` |
| `shedb` | `ShedB@123-dev-only` | `SHED` | `SHED-B` |

Seed data: 2 sheds, 10 items (5 per shed) with opening ledger rows, 4 users.
Never use these passwords outside a local demo.

### Useful commands

```bash
# server/
npm run typecheck        # tsc --noEmit (covers src, tests, prisma/seed.ts)
npm run lint             # biome check
npm run build            # tsc -p tsconfig.build.json → dist/index.js
npm run db:migrate       # prisma migrate dev
npm run db:seed          # demo data (no duplicates on re-run)
npm test                 # vitest + supertest, needs TEST_DATABASE_URL

# client/
npm run typecheck        # tsc --noEmit
npm run lint             # biome check
npm run build            # next build (standalone output)
```

## Deploying the demo

`docker-compose.prod.yml` is **self-contained, not an override**: it defines its
own `mysql`, `api` and `web` services, publishes only 5000 and 3000 (MySQL has
no published port), and runs `web` only after `api` reports healthy. Build args
carry both `NEXT_PUBLIC_*` values. Required variables: `MYSQL_ROOT_PASSWORD`,
`MYSQL_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`,
`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`.

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

The file has been validated with `docker compose config` using dummy secrets.
**No image has been built and no deployment exists.** Details:
`docs/06-deploy.md`.

## Repository layout

```text
rit/
  readme.md                  this page
  docker-compose.yml         local MySQL + api + web services
  docker-compose.prod.yml    self-contained production stack (demo host)
  server/                    Express API + Socket.IO
    prisma/                  schema, 1 migration, seed
    src/
      app.ts                 app wiring (middleware, routes, /health)
      index.ts               http server + socket + prod env gate
      config/                env, db, cors, socket
      middlewares/           auth, requireRole, validate, limiters, errorHandler
      modules/               auth, visits, sheds, items, logs, dashboard, users
      utils/                 jwt, password, csv, rowLocks, retry, visitStatus, errors
      validators/            zod schemas
    tests/                   vitest + supertest suites (real MySQL)
  client/                    Next.js 16 PWA
    src/app/                 login, gate, shed, admin routes, manifest
    src/components/          role screens (gate/shed/admin), PWA shell, UI primitives
    src/hooks/               queries, users, logs, socket invalidation
    src/providers/           auth (in-memory token), query, socket
    public/                  sw.js, offline.html, icons
  docs/                      see the index below
```

## Documentation index

| Document | What it covers |
| --- | --- |
| `docs/project-status.md` | **Authoritative** current state: what works, what is still open, what is unverified |
| `docs/decisions_made.md` | **Authoritative** accepted decisions and rules |
| `docs/00-product-scope.md` | Users, the 12 capabilities, in/out of scope, success criteria |
| `docs/01-architecture.md` | Tablet/API/DB diagram, request → transaction → push path, modules, auth, accepted risks |
| `docs/02-data-model.md` | Prisma models, enums, ledger invariant, indexes, migration history |
| `docs/03-api-contract.md` | Every route, payload, error code, role and shed-scoping rule |
| `docs/04-setup-and-env.md` | Local setup, environment variables, migrations, seed, troubleshooting |
| `docs/05-demo-and-seed.md` | Seed contents, the four logins, demo data reset, run sheet inputs |
| `docs/06-deploy.md` | Images, production compose, secrets, healthchecks, what is unverified |
| `docs/07-testing.md` | Test stack, fixtures, the suites, how to run them, known gaps |
| `docs/demo-script.md` | Scripted 3–5 vehicle demo walkthrough |
| `docs/phases/` | Build plans per phase, with acceptance checklists |
| `docs/specs_document.md` | Earlier spec; **stale** — still uses the concept doc's old status names |
| `docs/DMS_POC_Concept_Document.docx.pdf` | Original client-facing concept document (source of the 12 capabilities) |
