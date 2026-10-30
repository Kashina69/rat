# 04 — Setup and environment

How to run the Depot Management System (DMS) locally, what every environment variable does, how to
reach the test database, and how logins and user management behave. Written against the code as of
2026-10-30 (end of the fix pass). Decisions live in [`decisions_made.md`](./decisions_made.md);
current gaps live in [`project-status.md`](./project-status.md).

## 1. Prerequisites

| Requirement | Version / notes |
| --- | --- |
| Node.js | 20 or newer (`server/package.json` `engines`; Docker images use `node:20-slim`). Verified locally with Node 22.23.2. |
| npm | Ships with Node. `npm ci` is used, so `package-lock.json` is authoritative. |
| Docker Engine + Compose v2 | Commands use `docker compose` (not `docker-compose`). |
| MySQL | **8.4, from Docker only.** Do not install MySQL locally. |
| Free ports | 3000 (web), 5000 (api), 3306 (MySQL). |
| Optional | `mysql` client, for creating/dropping databases without `docker compose exec`. |

No Redis, no PostgreSQL, no message broker. Socket.IO runs in-process; a single API instance is the
POC target.

Node for shell commands in this repo:

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
```

## 2. First install

### 2.1 Database (Docker)

The dev compose file at the repo root defines `mysql`, `api` and `web`; for local development you
normally start just MySQL (§7 covers running the whole stack in Docker).

```bash
cd /home/prince/code/office/projects/rit
docker compose up -d mysql
docker compose ps          # wait for STATUS = healthy
```

Dev credentials created by `docker-compose.yml`: database `dms`, user `dms`, password `dms`, root
password `root`.

### 2.2 Server

```bash
cd server
cp .env.example .env       # then edit the values below
npm ci
npx prisma generate
npx prisma migrate deploy  # applies the existing migrations; no shadow DB needed
npm run db:seed            # optional: demo data, see 05-demo-and-seed.md
npm run dev                # http://localhost:5000, health at /health
```

Use `npm run db:migrate` (`prisma migrate dev`) only when you are changing the schema; it needs a
shadow database, so the `dms` user must be allowed to create one (see §11) or you run it with root
credentials.

`npm run dev` is `tsx watch src/index.ts`. The API refuses to boot without `DATABASE_URL` and
`JWT_SECRET`.

### 2.3 Client

```bash
cd client
cp .env.example .env.local  # Next loads .env.local first
npm ci
npm run dev                 # http://localhost:3000
```

`NEXT_PUBLIC_*` values are inlined **at build time** by Next. Changing them requires a restart (dev)
or a rebuild (prod).

## 3. Server environment

`server/.env` is loaded by `dotenv` from the `server/` working directory, so the API must be started
from that folder (or with `DATABASE_URL` exported).

| Variable | Required | Dev value | Purpose / production notes |
| --- | --- | --- | --- |
| `PORT` | no | `5000` | HTTP + Socket.IO port. Defaults to 5000. |
| `HOST` | no | `0.0.0.0` | Bind address. Defaults to `0.0.0.0`. |
| `NODE_ENV` | no | `development` | `production` turns on `assertProductionEnv()` (strong `JWT_SECRET`, explicit `CORS_ORIGIN`) and the seed's production rules. |
| `DATABASE_URL` | **yes** | `mysql://dms:dms@localhost:3306/dms` | Prisma connection string. In containers the host is the compose service name: `mysql:3306`. |
| `TEST_DATABASE_URL` | tests only | `mysql://dms:dms@localhost:3306/dms_test` | Read by `tests/setup-env.ts`, which forces it into `DATABASE_URL` and sets `NODE_ENV=test`. It must be passed on the command line or exported for `npm test`. |
| `JWT_SECRET` | **yes** | any long random string | Must be ≥ 32 chars and not a known default in production; the API refuses to start otherwise. |
| `JWT_EXPIRES_IN` | no | `8h` | Access-token lifetime (one shift). No refresh tokens. |
| `CORS_ORIGIN` | no | `http://localhost:3000` | Comma-separated exact origins. `*` is rejected in production. The socket server uses the same allowlist. |
| `TRUST_PROXY` | no | `0` | Number of proxy hops to trust. `0` ignores `X-Forwarded-For` (correct when the API port is reachable directly); `1` only behind exactly one load balancer. Rate limiters key on `req.ip`. |
| `SEED_ADMIN_PASSWORD` | prod seed | unset in dev | Overrides the `admin` dev fallback. Required when seeding with `NODE_ENV=production`. |
| `SEED_GATE_PASSWORD` | prod seed | unset in dev | Same, `gate`. |
| `SEED_SHEDA_PASSWORD` | prod seed | unset in dev | Same, `sheda`. |
| `SEED_SHEDB_PASSWORD` | prod seed | unset in dev | Same, `shedb`. |
| `ALLOW_DESTRUCTIVE_SEED` | seed only | unset | Set to `1` to permit `npm run db:seed -- --reset` while `NODE_ENV=production`. Anything else refuses the reset. |

`SEED_*_PASSWORD` values are **not** required for a production API boot; they are only required by
`prisma/seed.ts` when you actually seed in production.

## 4. Client environment

| Variable | Required | Dev value | Purpose / production notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | no (falls back to `http://localhost:5000`) | `http://localhost:5000` | REST base URL used by `lib/api-client.ts`. Baked in at build time. |
| `NEXT_PUBLIC_SOCKET_URL` | no (same fallback) | `http://localhost:5000` | Socket.IO server URL used by `lib/socket-client.ts`. Baked in at build time. |

Production: these must reach the **builder** stage of `client/Dockerfile`. That is wired up —
`client/Dockerfile` declares `ARG`/`ENV` for both, and `docker-compose.prod.yml` passes them under
`web.build.args` as required values (`:?`), so a missing value fails the build instead of silently
baking `localhost:5000`. The built bundle is still the only source of truth, so changing the public
URL means rebuilding the web image. See [`06-deploy.md`](./06-deploy.md#3-next_public_-are-build-time-values--runtime-env-does-nothing).

## 5. Database commands

Run from `server/`.

| Task | Command |
| --- | --- |
| Create/apply a migration (dev) | `npm run db:migrate` (= `prisma migrate dev`) |
| Apply existing migrations (CI/prod/container) | `npx prisma migrate deploy` |
| Check migration state | `npx prisma migrate status` |
| Seed demo data (non-destructive, refreshes passwords/roles/sheds) | `npm run db:seed` |
| Wipe + reseed demo data | `npm run db:seed -- --reset` |
| Drop, recreate, re-migrate | `npx prisma migrate reset` (no seed afterwards — no `prisma.seed` hook is configured) |
| Same, then seed | `npx prisma migrate reset && npm run db:seed -- --reset` |
| Manual hard reset | `(cd .. && docker compose exec mysql mysql -uroot -proot -e "DROP DATABASE IF EXISTS dms; CREATE DATABASE dms;")` then `npx prisma migrate deploy && npm run db:seed -- --reset` |
| Inspect data (optional) | `npx prisma studio` |

### Migration state

One squashed init migration:

| Migration | Adds |
| --- | --- |
| `20261029110447_init` | Full schema: sheds, users, items, visits, requirement lines, stock ledger, audit events; `users.isActive` (user management); `stock_ledger.reason VARCHAR(255)` (manual-adjust reasons). |

`npx prisma migrate status` reports up to date on `dms` (verified 2026-10-30); the test run applies
the same migration to `dms_test`. New schema changes must be new migrations, not edits to `init`.
Seeding never touches the schema.

Seed semantics (what each mode touches) are documented in
[05-demo-and-seed.md](./05-demo-and-seed.md#3-reset-behaviour).

## 6. `dms_test` (integration tests)

The Vitest suites run against a real MySQL database, because the stock code uses
`SELECT ... FOR UPDATE`. One-time setup:

```bash
cd /home/prince/code/office/projects/rit
docker compose exec mysql mysql -uroot -proot -e \
  "CREATE DATABASE IF NOT EXISTS dms_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
docker compose exec mysql mysql -uroot -proot -e \
  "GRANT ALL PRIVILEGES ON dms_test.* TO 'dms'@'%'; FLUSH PRIVILEGES;"
```

Run the suites:

```bash
cd server
TEST_DATABASE_URL=mysql://dms:dms@127.0.0.1:3306/dms_test npm test
```

- `tests/setup-env.ts` requires `TEST_DATABASE_URL`, copies it into `DATABASE_URL`, forces
  `NODE_ENV=test` and sets a test-only `JWT_SECRET` when none is present, so the run is
  self-contained.
- `truncateAll()` refuses any database whose name does not end in `_test`, so a mistyped URL
  aborts instead of wiping `dms`.
- Each file deploys migrations once per run; `fileParallelism` is off, so suites run one at a time.
- **`dms_test` is disposable.** Never point `TEST_DATABASE_URL` at `dms`.

See [07-testing.md](./07-testing.md) for the twelve files, the forty tests and what each covers.

## 7. Running both apps

| Way | Command | What you get |
| --- | --- | --- |
| Dev, two terminals | `cd server && npm run dev` and `cd client && npm run dev` | API on :5000 with watch reload, web on :3000 with HMR |
| Everything in Docker | `docker compose up -d --build` | MySQL, api (:5000), web (:3000); the api image runs `prisma migrate deploy` on start |

The two-terminal dev path is the supported one. The Docker build path is wired up but was **not**
build-verified in this pass (`docker compose config` was validated; no image was built) — test it
before relying on it for a time-boxed demo.

Open `http://localhost:3000` → redirects to `/login`. After login each role lands on its own tab
(`/gate`, `/shed`, `/admin`); the header tabs are UX only, the API enforces roles and shed scoping.

Health checks: `curl http://localhost:5000/health` → `{ "data": { "status": "ok", ... } }`.

Checks before handing a branch over (both are clean as of 2026-10-30):

```bash
cd server && npm run typecheck && npm run lint && npm run build   # 74 lint files
cd ../client && npm run typecheck && npm run lint && npm run build # 69 lint files
```

Both packages now have a `typecheck` script; `npx tsc --noEmit` is equivalent. The server
`typecheck` covers `src`, `tests` and `prisma/seed.ts`; `npm run build` (`tsconfig.build.json`)
excludes `tests`, so test files never reach `dist`.

## 8. Dev seed passwords

The seed uses these fallbacks only when the matching `SEED_*_PASSWORD` is unset **and** `NODE_ENV`
is not `production`. They are development-only and must never reach a deployed environment.

| Username (lowercase) | Role | Shed | Dev fallback password |
| --- | --- | --- | --- |
| `admin` | ADMIN | — | `Admin@123-dev-only` |
| `gate` | GATE | — | `Gate@123-dev-only` |
| `sheda` | SHED | SHED-A | `ShedA@123-dev-only` |
| `shedb` | SHED | SHED-B | `ShedB@123-dev-only` |

**Password rotation works on a plain reseed.** The four seeded users are `upsert`ed with
`name`, `passwordHash`, `role` and `shedId` in the `update` branch, so re-running `npm run db:seed`
without `--reset` applies any new `SEED_*_PASSWORD` value immediately. Passwords are bcrypt-hashed
with 12 rounds and never printed.

Two things a plain reseed does **not** change: `users.isActive` (a seeded account you disabled stays
disabled until you enable it again) and any user created through the admin screen (they are not
seed-owned).

Two ways to change a password without touching env vars:

- Admin → Users → **Reset password** (`POST /api/users/:id/reset-password`), or
- the demo `--reset` reseed, which recreates the four seeded accounts from scratch.

## 9. Logins, disabling and lockout behaviour

User management is built: admin create/edit/disable/reset in the admin screen
(`client/src/components/admin/{UsersTable,UserEditor}.tsx`) over `GET/POST /api/users`,
`PATCH /api/users/:id`, `POST /api/users/:id/reset-password`, all `ADMIN` only
(`server/src/modules/users/`).

| Behaviour | Result |
| --- | --- |
| Wrong password or unknown username | `401 INVALID_CREDENTIALS`, message `Invalid credentials`. |
| Disabled account tries to log in | Same generic `401 INVALID_CREDENTIALS` — the API does not reveal that the account exists but is disabled. |
| Token issued before the account was disabled | `403 ACCOUNT_DISABLED` (`This account is disabled`) from the auth middleware on the next request. |
| Admin disables itself | `409 CANNOT_DISABLE_SELF`. |
| Admin disables the last remaining admin | **Allowed** — there is no last-admin protection, so a single admin can lock the deployment out of user management. Recovery is a direct DB update (`UPDATE users SET isActive = 1 WHERE username = 'admin';`) or a reseed, because no active admin remains to re-enable it. |
| Password reset by admin | Takes effect on the next login; tokens already issued stay valid until they expire (no revocation). |
| Password rules | 8–72 characters. Usernames 3–64, lowercase in the seed. |
| `SHED` role without a shed, or a shed on `ADMIN`/`GATE` | `400 VALIDATION_ERROR` on create; `400 SHED_REQUIRED` / `400 SHED_NOT_ALLOWED` from the service when an existing user is edited. |
| Duplicate username | `409 DUPLICATE`. |
| Passwords in responses | Never — `passwordHash` is not in any response (`userSelect`). |
| Sessions | JWT in memory only, ~8h, no refresh and no server-side revocation: a disabled user's token is rejected by the middleware, but nothing else invalidates it. |

There is no lockout after N failed logins. The only throttling is the API rate limiter
(`express-rate-limit`, keyed on `req.ip`).

## 10. Production notes

`docker-compose.prod.yml` is self-contained (not an override) and defines `mysql`, `api`
(build `./server`) and `web` (build `./client`), with required-value interpolation (`:?`), MySQL
healthchecks, `api`/`web` healthchecks and `depends_on: service_healthy`.

**Status:** `docker compose -f docker-compose.prod.yml config` was run with dummy secrets and the
file validates. No image was built and the stack was never started, so §10 is validated
configuration, not a proven recipe.

| Compose variable | Required | Notes |
| --- | --- | --- |
| `MYSQL_ROOT_PASSWORD` | yes | Interpolated into the MySQL service. |
| `MYSQL_DATABASE` | no | Defaults to `dms`. |
| `MYSQL_USER` | no | Defaults to `dms`. |
| `MYSQL_PASSWORD` | yes | Password for the app user. |
| `DATABASE_URL` | yes | e.g. `mysql://dms:<password>@mysql:3306/dms` (managed MySQL URL if hosted). |
| `JWT_SECRET` | yes | ≥ 32 chars, not in the weak-secret denylist. Generated per deployment, stored in a secrets manager. |
| `JWT_EXPIRES_IN` | no | Defaults to `8h`. |
| `CORS_ORIGIN` | yes | Exact comma-separated origins, no `*`. |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` | yes | Passed as **build args** to the web image. |
| `ALLOW_DESTRUCTIVE_SEED` | seed only | Not set by the compose file. Only export it for a deliberate production `--reset`. |

MySQL has no published port in the prod file. `TRUST_PROXY` is not passed by the prod file either;
add it to the `api` environment only after the API port is removed from the public interface (see
[`06-deploy.md`](./06-deploy.md#11-remaining-gaps)).

### Seed guards in production

- **Plain seed:** never falls back to a default password. `server/prisma/seed.ts` exits non-zero
  with `Refusing to seed in production: missing SEED_*_PASSWORD.` unless all four
  `SEED_ADMIN_PASSWORD`, `SEED_GATE_PASSWORD`, `SEED_SHEDA_PASSWORD`, `SEED_SHEDB_PASSWORD` are set.
- **`--reset` guard:** implemented. `npm run db:seed -- --reset` with `NODE_ENV=production` aborts
  with `Refusing to run --reset with NODE_ENV=production. Set ALLOW_DESTRUCTIVE_SEED=1 to override.`
  The override is an env flag, not a flag on the command line, so it cannot be set by accident in a
  copy-pasted shell history. The guard is the only safety net: with `ALLOW_DESTRUCTIVE_SEED=1` the
  reset really does delete every row.
- Seeding inside the production images is still not wired up: `seed.ts` is copied into the api
  image, but `tsx` is pruned with dev dependencies, so `npm run db:seed` cannot run there. Seed from
  a checkout or a build-stage image.
- `npm audit --omit=dev` currently reports 5 advisories (3 high, 2 moderate) from Prisma's
  `deepmerge-ts` and ExcelJS's `uuid`; there is no non-breaking fix yet. See
  [`06-deploy.md`](./06-deploy.md#11-remaining-gaps).

## 11. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `P1001 Can't reach database server at localhost:3306` | MySQL container not up or not healthy. `docker compose ps`, then `docker compose up -d mysql`. Inside containers the host must be `mysql`, not `localhost`. |
| `P1000 Authentication failed` | Credentials do not match the volume's original users. If the `dms-mysql` volume was created with other values, recreate it: `docker compose down -v && docker compose up -d mysql` (destroys dev data). |
| `Port 3306 is already allocated` | A local MySQL is running. Stop it, or change the host-side port mapping in `docker-compose.yml`. |
| `Environment variable not found: DATABASE_URL` | `.env` missing, or the API was started outside `server/`. `cp .env.example .env`. |
| `Missing required env var: JWT_SECRET` | Set `JWT_SECRET` in `server/.env`; no default is provided. |
| `@prisma/client did not initialize yet` | Run `npx prisma generate` after `npm ci` or schema changes. |
| `prisma migrate dev` fails with P3014 (shadow database) | The `dms` user cannot create/drop the shadow DB. Dev-only fix: `docker compose exec mysql mysql -uroot -proot -e "GRANT ALL PRIVILEGES ON *.* TO 'dms'@'%'; FLUSH PRIVILEGES;"` — or run the migration with a root `DATABASE_URL`. `migrate deploy` never needs a shadow DB. |
| Tests: `TEST_DATABASE_URL is required` | Pass it inline (`TEST_DATABASE_URL=... npm test`) or export it; it is not read from `.env` unless dotenv has already loaded it. |
| Tests: `Refusing to truncate database "dms"` | `TEST_DATABASE_URL` (or `DATABASE_URL`) points at a non-`_test` database. Fix the URL; the guard is a feature. |
| Tests: `Unknown database 'dms_test'` | Create it (§6). The test setup runs migrations, it does not create the database. |
| Seed: `Refusing to run --reset with NODE_ENV=production` | Working as intended (§10). Unset `NODE_ENV` for a dev reset, or set `ALLOW_DESTRUCTIVE_SEED=1` deliberately. |
| Seed: `Refusing to seed in production: missing SEED_*_PASSWORD` | Export all four seed passwords before running the seed in production. The API itself boots without them. |
| Login returns 401 with the documented passwords | `SEED_*_PASSWORD` was set when seeding (the env value wins), or the password was changed from the admin screen. Re-run `npm run db:seed` to re-apply the env/fallback passwords, or log in with the value the env supplied. |
| A user is disabled and nobody can re-enable them | No last-admin protection: if the only admin was disabled, fix it in the database (`UPDATE users SET isActive = 1 WHERE username = 'admin';`) or reseed. |
| Browser blocks API calls (CORS) | `CORS_ORIGIN` must exactly match the browser origin (scheme + host + port), comma-separated for several, never `*` in production. |
| UI shows data but never updates live | Socket URL wrong/not allowlisted. On token expiry the server now emits `session.expired` and the client logs out with a toast, so "live updates died silently" should no longer happen; a stale tab means the socket never connected. |
| Install prompt never appears | PWA install needs HTTPS (or `localhost`) plus the manifest and icons; verify on the target tablet, not just desktop. |
| Tablet reload lands on `/login` | Expected: the token lives in memory only, so every cold launch requires login. |
| `npm run lint` fails | Biome. `npm run format` in the affected package fixes formatting; lint errors are real. |
| Production web bundle calls `localhost:5000` | Should not happen any more: the build args are required in `docker-compose.prod.yml`. If it does, the image was built before the args were supplied — rebuild with `NEXT_PUBLIC_*` exported. |
