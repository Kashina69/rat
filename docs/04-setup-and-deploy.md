# 04 — Setup, environment and deploy

> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

Commands, environment variables and deployment, verified against the code on 2026-10-30. Seed
content and reset behaviour: @docs/05-demo-and-seed.md. Tests: @docs/06-testing.md.

## 1. Prerequisites

- Node.js 20+ (`engines: >=20`; images use `node:20-slim`, verified on 22.23.2) and `npm ci` — the
  lockfile is authoritative. Docker Engine + Compose v2 (`docker compose`, not `docker-compose`).
- **MySQL 8.4 from Docker only** — do not install MySQL locally. Ports 3000, 5000 and 3306 free.
- No Redis, no PostgreSQL, no broker: Socket.IO is in-process and the POC targets one API instance.

## 2. Local setup

```bash
cd /projects/rat
docker compose up -d mysql && docker compose ps     # wait for STATUS = healthy
cd server && cp .env.example .env                   # then edit
npm ci && npx prisma generate && npx prisma migrate deploy && npm run db:seed
npm run dev                                         # tsx watch → :5000, /health
cd ../client && cp .env.example .env.local && npm ci && npm run dev   # next dev → :3000
```

Dev DB credentials come from `docker-compose.yml`: db `rat`, user `rat`, password `rat`, root
password `root`. `server/.env` is loaded by `dotenv` from `server/`; start the API there — it refuses
to boot without `DATABASE_URL` and `JWT_SECRET`.

## 3. Server environment (`server/.env`)

| Variable | Required | Dev value | Purpose / production notes |
| --- | --- | --- | --- |
| `PORT`, `HOST` | no | `5000`, `0.0.0.0` | HTTP + Socket.IO port and bind address. |
| `NODE_ENV` | no | `development` | `production` enables `assertProductionEnv()` and the seed's production rules. |
| `DATABASE_URL` | **yes** | `mysql://rat:rat@localhost:3306/rat` | Prisma URL; in containers the host is `mysql:3306`. |
| `TEST_DATABASE_URL` | tests only | `mysql://rat:rat@localhost:3306/rat_test` | Read by `tests/setup-env.ts`, which forces it into `DATABASE_URL` and sets `NODE_ENV=test`. Pass inline. |
| `JWT_SECRET` | **yes** | long random string | ≥ 32 chars, not a known default in production, else the API refuses to boot. |
| `JWT_EXPIRES_IN` | no | `8h` | Access-token lifetime (one shift); no refresh tokens. |
| `CORS_ORIGIN` | no | `http://localhost:3000` | Comma-separated exact origins; `*` rejected in production. Shared with Socket.IO. |
| `TRUST_PROXY` | no | `0` | Proxy hops to trust. `0` ignores `X-Forwarded-For` (API reachable directly); `1` only behind exactly one LB. Rate limiters key on `req.ip`. |
| `SEED_ADMIN_PASSWORD`, `SEED_GATE_PASSWORD`, `SEED_SHEDA_PASSWORD`, `SEED_SHEDB_PASSWORD` | prod seed | unset | Override the dev fallbacks; all four required when seeding under `NODE_ENV=production`. **Not** needed for a production API boot. |
| `ALLOW_DESTRUCTIVE_SEED` | seed only | unset | Must be `1` to permit `npm run db:seed -- --reset` while `NODE_ENV=production`; anything else refuses the reset. |

## 4. Client environment (`client/.env.local`)

| Variable | Required | Dev value | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | no (falls back to `http://localhost:5000`) | `http://localhost:5000` | REST base for `lib/api-client.ts`. Inlined **at build time**. |
| `NEXT_PUBLIC_SOCKET_URL` | no (same fallback) | `http://localhost:5000` | Socket.IO URL for `lib/socket-client.ts`. Inlined **at build time**. |

A `NEXT_PUBLIC_*` change needs a dev restart and a production **rebuild** (§10).

## 5. Database commands (from `server/`)

| Task | Command |
| --- | --- |
| Create/apply a migration (dev, needs a shadow DB) | `npm run db:migrate` (= `prisma migrate dev`) |
| Apply existing migrations, check state | `npx prisma migrate deploy`, `npx prisma migrate status` |
| Seed demo data (non-destructive; refreshes passwords/roles/sheds) | `npm run db:seed` |
| Wipe + reseed demo data | `npm run db:seed -- --reset` |
| Drop, recreate, re-migrate, reseed | `npx prisma migrate reset && npm run db:seed -- --reset` |
| Inspect data | `npx prisma studio` |

**One squashed init migration:** `20261029110447_init` — full schema (sheds, users, items, visits,
requirement lines, stock ledger, audit events) including `users.isActive` and
`stock_ledger.reason VARCHAR(255)`. New schema changes must be new migrations, never edits to `init`.
A P3014 from `migrate dev` means the `rat` user cannot create a shadow DB — grant it as root
(`docker compose exec mysql mysql -uroot -proot -e "GRANT ALL PRIVILEGES ON *.* TO 'rat'@'%';"`) or
migrate as root; `migrate deploy` never needs one.

## 6. `rat_test` (test database)

Suites use real MySQL because the stock code takes `SELECT … FOR UPDATE` row locks. One-time setup:

```bash
docker compose exec mysql mysql -uroot -proot -e "CREATE DATABASE IF NOT EXISTS rat_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
docker compose exec mysql mysql -uroot -proot -e "GRANT ALL PRIVILEGES ON rat_test.* TO 'rat'@'%'; FLUSH PRIVILEGES;"
```

`rat_test` is disposable: `truncateAll()` refuses any database whose name does not end in `_test`, so
a mistyped URL aborts instead of wiping `rat`. Never point `TEST_DATABASE_URL` at `rat`; run
command: @docs/06-testing.md.

## 7. Running both apps

| Way | Command | What you get |
| --- | --- | --- |
| Dev, two terminals (supported) | `cd server && npm run dev` + `cd client && npm run dev` | API :5000 with watch reload, web :3000 with HMR |
| Everything in Docker | `docker compose up -d --build` | MySQL, api :5000, web :3000; api runs `prisma migrate deploy` on start |

The Docker path is wired up but **was not build-verified in this pass** (`docker compose config`
validated, no image built); for a LAN tablet, set the two `NEXT_PUBLIC_*` build args to the host LAN IP
before `docker compose build web`. Web runs at `:3000` → `/login`, then each role's own tab (`/gate`,
`/shed`, `/admin`) — UX only, the API enforces roles and shed scoping.

Pre-handover checks, both clean on 2026-10-30 (server build excludes `tests/`):

```bash
cd server && npm run typecheck && npm run lint && npm run build      # 74 lint files
cd ../client && npm run typecheck && npm run lint && npm run build   # 69 lint files
```

## 8. Dev seed passwords

Fallbacks apply only when the matching `SEED_*_PASSWORD` is unset **and** `NODE_ENV` is not
`production`. Development only — never let them reach a deployed environment.

| Username | Role | Shed | Dev fallback password |
| --- | --- | --- | --- |
| `admin` | ADMIN | — | `Admin@123-dev-only` |
| `gate` | GATE | — | `Gate@123-dev-only` |
| `sheda` | SHED | SHED-A | `ShedA@123-dev-only` |
| `shedb` | SHED | SHED-B | `ShedB@123-dev-only` |

Seeded users are `upsert`ed with `name`, `passwordHash`, `role`, `shedId` in the update branch, so a
plain reseed applies a new `SEED_*_PASSWORD` immediately; it does **not** touch `users.isActive` or
users created in the admin screen. Passwords are bcrypt-hashed (12 rounds) and never printed.

## 9. Logins, disabling and lockout

Admin create/edit/disable/reset runs over `GET/POST /api/users`, `PATCH /api/users/:id` and
`POST /api/users/:id/reset-password`, all ADMIN-only (`server/src/modules/users/`). Shapes:
@docs/03-api-contract.md.

| Behaviour | Result |
| --- | --- |
| Wrong password or unknown username | `401 INVALID_CREDENTIALS`, message `Invalid credentials`. |
| Disabled account tries to log in | Same generic `401 INVALID_CREDENTIALS` — presence is not revealed. |
| Token issued before the account was disabled | `403 ACCOUNT_DISABLED` from the auth middleware on the next request. |
| Admin disables itself | `409 CANNOT_DISABLE_SELF`. |
| Admin disables the last admin | **Allowed** — no last-admin protection. Recovery: `UPDATE users SET isActive = 1 WHERE username = 'admin';` or a reseed, since no active admin remains. |
| Password reset by admin | Applies on the next login; issued tokens stay valid until they expire (no revocation). |
| `SHED` role without a shed, a shed on `ADMIN`/`GATE`, or a duplicate username | `400 VALIDATION_ERROR` on create; `400 SHED_REQUIRED` / `400 SHED_NOT_ALLOWED` on edit; `409 DUPLICATE`. |

Passwords 8–72 characters; usernames 3–64, lowercase in the seed; `passwordHash` never appears in a
response (`userSelect`). Sessions are a JWT in memory, ~8h, no refresh and no server-side revocation —
only the auth middleware rejects a disabled user's token. There is **no lockout** after N failed
logins; the only throttle is `express-rate-limit` on `req.ip`.

## 10. Production deploy

`docker-compose.prod.yml` is **self-contained, not an override** — it redeclares `mysql`, `api`
(build `./server`) and `web` (build `./client`), so run it alone. Flow: `tablet → HTTPS → LB →
web:3000 → api:5000 → mysql:3306`, one host, one India region, MySQL never published.

**Status:** `config` validates with dummy secrets; no image built, no `up`, no host, DNS, certificate,
HTTPS endpoint or public link — validated configuration, not a proven recipe.

Required (`${VAR:?…}` aborts if missing): `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD`, `DATABASE_URL`,
`JWT_SECRET`, `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`. Optional:
`MYSQL_DATABASE`/`MYSQL_USER` (default `rat`), `JWT_EXPIRES_IN` (`8h`). `ALLOW_DESTRUCTIVE_SEED` is
not set by compose; export it only for a deliberate production `--reset`.

- **Ports:** mysql 3306 unpublished in prod (required); api 5000 published but should become private;
  web 3000 published — the only thing a browser should reach, behind TLS.
- **Healthchecks:** mysql `mysqladmin ping` (10s, 12 retries); api on `/health`, web on `/` (15s,
  6 retries, 30–40s start), in both compose files and Dockerfiles, with `api` waiting on
  `mysql: service_healthy` and `web` on `api: service_healthy`. `/health` sits before the rate limiter
  and needs no token, but touches nothing — **liveness only**, `ok` with MySQL down.
  `restart: always` acts on process exit only.
- **`NEXT_PUBLIC_*` are build-time.** `client/Dockerfile` declares `ARG`/`ENV` in the builder stage
  and the prod compose passes required `build.args`, so a missing value fails the build instead of
  silently baking the `http://localhost:5000` fallback. A URL change means rebuilding the web image;
  no secret may live in `NEXT_PUBLIC_*`.
- **Secrets:** `.env` is gitignored and excluded from both build contexts by per-context
  `.dockerignore` files; inject from a secret store. Rotating `JWT_SECRET` logs every tablet out; the
  `.env.example` placeholder is rejected in production. `TRUST_PROXY` is **not** set by the prod file —
  add `TRUST_PROXY: "1"` only once the API port stops being published, or `X-Forwarded-For` becomes
  spoofable and the rate limiters are defeated.
- **HTTPS at the LB.** TLS terminates there; everything behind is plain HTTP on a private network. One
  public origin matching `CORS_ORIGIN` exactly; redirect 80 → 443; HSTS at the LB; pass the
  `/socket.io` upgrade with buffering off and an idle timeout above the heartbeat; no sticky sessions,
  so **one API instance**; never cache `/sw.js`. HTTPS is mandatory for the PWA — service-worker
  registration and install need a secure origin.
- **Region: India.** web, api and MySQL in the same India region and VPC, one instance each (e.g.
  `ap-south-1`): a ~120–250 ms round trip per call disappears and depot data stays in India. Keep
  containers on **UTC** — not `TZ=Asia/Kolkata` — because the UI sends `YYYY-MM-DD` and the API
  converts it to IST day bounds (`server/src/utils/datetime.ts`).
- **Migrations on start.** The api CMD is `sh -c "npx prisma migrate deploy && node dist/index.js"`, so
  each start migrates before listening; a failure exits non-zero → `restart: always` → crash loop,
  first error line in `docker compose logs api`. Two replicas would both migrate — keep one API
  container. There are **no down migrations**: snapshot before a schema change. Seeding is never
  automatic and cannot run in the runtime image (`tsx` pruned, `seed.ts` not compiled).

## 11. Open deploy gaps

Current list: `@docs/project-status.md` (Still open). Deploy-specific: API port published until behind
a TLS proxy; containers run as root; Node 20 images vs the verified Node 22 toolchain; no image build,
`up`, host, DNS, certificate or public link; 5 transitive audit advisories.

Related: @docs/05-demo-and-seed.md, @docs/06-testing.md, @docs/01-architecture.md, @docs/project-status.md
