# 06 — Deploy

How the DMS POC is built, run locally, and shipped to a public demo link. Current status for every
item below lives in [`docs/project-status.md`](./project-status.md); product rules live in
[`docs/decisions_made.md`](./decisions_made.md).

**Current state (2026-10-30):** both images and both compose files exist, and the production compose
file was validated with `docker compose -f docker-compose.prod.yml config` using dummy secrets. It
carries the `NEXT_PUBLIC_*` build args, healthchecks for `api` and `web`, and an unpublished MySQL
port. **No Docker image has been built, the stack has never been started, and there is no
production deployment, HTTPS endpoint or public link.** Everything below is validated configuration
plus one honest list of what is still open (§11).

Local setup and the variable-by-variable reference are in
[`docs/04-setup-and-env.md`](./04-setup-and-env.md); seed contents in
[`docs/05-demo-and-seed.md`](./05-demo-and-seed.md).

---

## 1. Topology

Three containers, one MySQL, one public hostname. Nothing else.

| | Development (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|---|---|---|
| MySQL | `mysql:8.4`, root/root, db `dms`, user `dms`/`dms` | `mysql:8.4`, credentials from env (`${VAR:?}` fails fast if unset) |
| API | Express 5 image from `./server`, env from `./server/.env` plus overrides | Same image, `NODE_ENV=production`, env from compose only |
| Web | Next.js 16 standalone image from `./client` | Same image, `NEXT_PUBLIC_*` passed as **build args** |
| Published | `3306`, `5000`, `3000` | `5000` and `3000` only — MySQL is not published |
| Startup order | api waits for MySQL healthy; web waits for api healthy | same |
| Data | named volume `dms-mysql` | named volume `dms-mysql` on one host (no snapshot story) |
| Intended path | your laptop | load balancer → `web:3000` → `api:5000` → `mysql:3306` |

`docker-compose.prod.yml` is **self-contained**, not an override — its header says so, and it
redeclares all three services. Run one file or the other, not both (§11.7).

---

## 2. Running it

### 2.1 Local development (Docker)

```bash
cd /home/prince/code/office/projects/rit

cp server/.env.example server/.env      # DATABASE_URL is overridden by compose
docker compose up --build
```

- Web: <http://localhost:3000>
- API health: <http://localhost:5000/health> → `{ "data": { "status": "ok", "uptime": … } }`
- MySQL: `localhost:3306`, user `dms`, password `dms`, database `dms`

The `api` service loads `./server/.env` via `env_file`, then overrides `DATABASE_URL` to
`mysql://dms:dms@mysql:3306/dms`, `PORT=5000`, `HOST=0.0.0.0`. Web build args default to
`http://localhost:5000` (`${NEXT_PUBLIC_API_URL:-http://localhost:5000}`), which is correct only
for a browser running on the same machine. **To test from a tablet on the LAN, set
`NEXT_PUBLIC_API_URL=http://<host-lan-ip>:5000` (and the socket URL) before `docker compose build
web`,** because those values are baked into the bundle (§3).

This Docker dev path has not been built or started in this pass. The two-terminal path in §2.2 is
the one that was exercised.

### 2.2 Local development (no Docker)

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH

cd server
npm ci
npx prisma migrate deploy       # or: npm run db:migrate when changing the schema
npm run db:seed                 # optional demo data
npm run dev                     # tsx watch src/index.ts → :5000

cd ../client
npm ci
npm run dev                     # next dev → :3000, reads client/.env.local
```

`server/.env` needs `DATABASE_URL` and `JWT_SECRET` (`TEST_DATABASE_URL` only for tests); `client`
needs `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` or it falls back to `http://localhost:5000`.

### 2.3 Production

The committed root `.env.example` is **empty**, so the root `.env` has to be written by hand:

```bash
cd /home/prince/code/office/projects/rit

cat > .env <<'EOF'
MYSQL_ROOT_PASSWORD=<long random>
MYSQL_DATABASE=dms
MYSQL_USER=dms
MYSQL_PASSWORD=<long random>
DATABASE_URL=mysql://dms:<same password>@mysql:3306/dms
JWT_SECRET=<48+ random chars>
JWT_EXPIRES_IN=8h
CORS_ORIGIN=https://dms.example.in
NEXT_PUBLIC_API_URL=https://dms.example.in
NEXT_PUBLIC_SOCKET_URL=https://dms.example.in
EOF

docker compose -f docker-compose.prod.yml config     # validate before building
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f api # migrations, then boot
```

Or point the file at a managed MySQL by changing `DATABASE_URL` (then the local `mysql` service is
unused and can be dropped from the invocation with `up -d --build api web`).

`SEED_*_PASSWORD` (four values) are needed only when you actually run `npm run db:seed` under
`NODE_ENV=production` — the API does not require them to boot. The seed refuses to run in production
without them, so keep them in the secret store, not in this file if you can.

**Status:** the steps in §2.3 were never executed. `config` passes with dummy values; `up -d --build`
has not been run on any host.

### 2.4 Post-deploy smoke test (not yet run)

```bash
curl -fsS https://dms.example.in/health        # { data: { status: "ok" } }
curl -fsS -X POST https://dms.example.in/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"<seed admin password>"}'
```

Then run [`docs/demo-script.md`](./demo-script.md) from step 1: one single-shed vehicle, one
multi-shed vehicle.

---

## 3. `NEXT_PUBLIC_*` are build-time values — runtime env does nothing

`client/src/lib/api-client.ts` and `client/src/lib/socket-client.ts` read
`process.env.NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SOCKET_URL`. Next.js **inlines** `NEXT_PUBLIC_*`
during `next build`, replacing every occurrence with a string literal, and
`client/next.config.ts` uses `output: "standalone"`. The value present in the **builder** stage is
the value the tablets will use forever.

How it is wired (validated by reading both files and by a successful `config` run):

```dockerfile
# client/Dockerfile, builder stage, before `npm run build`
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
```

```yaml
# docker-compose.prod.yml, web service
    build:
      context: ./client
      args:
        NEXT_PUBLIC_API_URL: ${NEXT_PUBLIC_API_URL:?NEXT_PUBLIC_API_URL required}
        NEXT_PUBLIC_SOCKET_URL: ${NEXT_PUBLIC_SOCKET_URL:?NEXT_PUBLIC_SOCKET_URL required}
```

Why runtime env alone is wrong:

- `environment:` on the `web` container only affects the Node process *after* the bundle is frozen.
  The container starts happily and serves a bundle pointing somewhere else.
- Both readers fall back to `"http://localhost:5000"`, so a missing build-time value fails silently.
  The `:?` interpolation now turns that into a compose error before anything is built.
- Changing the public URL requires **rebuilding the web image**, not restarting the container. The
  build args fix has not been proven by an actual image build — that is the remaining gap, not the
  wiring.

Consequences to plan around:

1. One image per environment. A staging image cannot be promoted to production with different URLs;
   rebuild it.
2. Nothing secret goes in `NEXT_PUBLIC_*` — anything inlined is readable in the browser.
3. A same-origin design (`https://dms.example.in/api` and `/socket.io` proxied by the load balancer,
   relative base URL) would remove build args, but the client always prefixes an absolute base with a
   localhost fallback, so it needs a code change first.

---

## 4. Ports

| Service | Container port | Dev publish | Prod publish | Notes |
|---|---|---|---|---|
| `mysql` | 3306 | `3306:3306` | none | Must never be publicly reachable in production (§6) |
| `api` | 5000 (`PORT`, `HOST=0.0.0.0`) | `5000:5000` | `5000:5000` | Should be private — see §11.1 |
| `web` | 3000 (`PORT`, `HOSTNAME=0.0.0.0`) | `3000:3000` | `3000:3000` | The only thing a browser should reach, behind TLS |

`EXPOSE` in the Dockerfiles is documentation; compose `ports:` is what publishes. Dev publishing
3306 and 5000 is fine on a laptop.

---

## 5. Healthchecks

| Service | Probe | Where | Timing |
|---|---|---|---|
| `mysql` | `mysqladmin ping` — dev pings `localhost` with the hardcoded `dms`/`dms`, prod pings `127.0.0.1` with `-u$MYSQL_USER -p$MYSQL_PASSWORD --silent` | both compose files | 10s interval, 5s timeout, 12 retries, 30s start |
| `api` | `fetch('http://localhost:5000/health')` | both compose files + `server/Dockerfile` | 15s interval, 5s timeout, 6 retries, 30–40s start |
| `web` | `fetch('http://localhost:3000/')` | both compose files + `client/Dockerfile` | 15s interval, 5s timeout, 6 retries, 30s start |

- Startup is gated: `api` has `depends_on: mysql: condition: service_healthy`, and `web` has
  `depends_on: api: condition: service_healthy`, in both files. The api's 40 s start period in the
  prod file leaves room for `prisma migrate deploy` (§10).
- `GET /health` is registered in `server/src/app.ts` **before** the `app.use("/api", apiLimiter)`
  mount, so the probe is not rate-limited and needs no token. It touches nothing — it is a
  **liveness** signal and reports `ok` even when MySQL is unreachable.
- The web probe requests `/`, which may redirect; `fetch` follows redirects, so it reports healthy as
  long as the app answers. It is not an auth check.
- `restart: always` (prod) / `unless-stopped` (dev) acts on process exit only. There is no autoheal
  sidecar, so an unhealthy-but-running container stays up until something restarts it.
- All three healthchecks are configuration that validates; none has been observed running.

---

## 6. Database exposure rules (required)

1. **No `3306` on the public interface.** `docker-compose.prod.yml` does not publish MySQL and must
   stay that way. The dev file does publish it — laptops only.
2. Prefer a **managed MySQL** in a private subnet whose security group allows only the API host, with
   TLS in the connection string: `mysql://user:pass@host:3306/dms?sslaccept=strict` (Prisma MySQL
   connector syntax). No TLS terminator in front of MySQL.
3. For temporary admin access, use an in-network shell instead of publishing the port:

   ```bash
   docker compose -f docker-compose.prod.yml exec mysql \
     mysql -u dms -p"$MYSQL_PASSWORD" dms
   ```

   Or an SSH tunnel to the private host. If a port truly must be open for debugging, bind it to
   loopback (`127.0.0.1:3306:3306`) and close it afterwards.
4. The API is the only writer. All stock changes run inside `db.$transaction` with
   `SELECT … FOR UPDATE` row locks, so a second writer on the same schema would break the ledger
   invariant (`SUM(delta) == currentStock`).
5. Backups are not implemented: `dms-mysql` is a plain Docker volume on a single host. Take a
   snapshot before any schema change, because migrations here are forward-only (§10).

---

## 7. Secrets

| Variable | Used by | Rule |
|---|---|---|
| `JWT_SECRET` | API | ≥32 chars, not one of the known defaults — `assertProductionEnv()` in `server/src/config/env.ts` refuses to boot otherwise. Rotating it logs every tablet out (no refresh tokens). |
| `CORS_ORIGIN` | API | Explicit comma-separated origins, never `*`. Production boot fails otherwise. Shared by Express CORS and Socket.IO. |
| `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` | MySQL | `${VAR:?…}` aborts compose if missing (`MYSQL_DATABASE`/`MYSQL_USER` default to `dms`) |
| `DATABASE_URL` | API | `mysql://…@mysql:3306/dms` on the compose network, or the managed instance + TLS |
| `JWT_EXPIRES_IN` | API | Default `8h` — one shift |
| `TRUST_PROXY` | API | Proxy hops to trust: `0` (default, ignore `X-Forwarded-For`) or `1` behind exactly one LB. **Not set by the prod compose file**; add it there only after the API port is no longer published (§8, §11.1). |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` | web **build** | Public origin, no trailing slash; baked into the bundle (§3). Required by `web.build.args`. |
| `SEED_*_PASSWORD` (4) | seed only | Required for a production seed; the API boots without them |
| `ALLOW_DESTRUCTIVE_SEED` | seed only | Must be `1` to allow `npm run db:seed -- --reset` under `NODE_ENV=production`. Not set by compose. |

Handling:

- Inject from the provider's secret store or a host-only `.env`. `.env` is gitignored (root
  `.gitignore`) and excluded from both Docker build contexts by the per-context `.dockerignore`
  files.
- No secret in `NEXT_PUBLIC_*` — those are inlined into the browser bundle.
- Demo seed passwords cover synthetic data only. Never seed a depot with real inventory data.
- `server/.env.example` documents the formats; its placeholder
  `change-me-to-a-long-random-string` is explicitly rejected in production.

---

## 8. HTTPS at the load balancer

TLS terminates at the LB; everything behind it is plain HTTP on a private network.

```
tablet ── HTTPS ──▶ LB (TLS, HSTS, 80→443) ── HTTP ──▶ web:3000 ──▶ api:5000 ──▶ mysql:3306
```

Required configuration:

- **One public origin**, e.g. `https://dms.example.in`, matching `CORS_ORIGIN` **exactly** (scheme +
  host + optional port, no trailing slash, no wildcard). `CORS_ORIGIN` also governs Socket.IO
  handshake origins (`server/src/config/socket.ts` → `isOriginAllowed`).
- **Redirect 80 → 443** at the LB. Helmet already emits baseline security headers; HSTS is best
  owned by the LB.
- **Client IP / `TRUST_PROXY`.** The app only trusts forwarded headers when `TRUST_PROXY` is a
  positive integer (`trustProxyHops()` in `server/src/app.ts`), and the prod compose file does not set
  it, so the default is `0` and `X-Forwarded-For` is ignored. Set `TRUST_PROXY=1` when the API sits
  behind exactly one proxy **and is not directly reachable** — leaving `5000:5000` published while
  trusting one hop would let clients spoof their IP and dodge the rate limiters, which key on
  `req.ip`.
- **WebSocket upgrade for `/socket.io`.** The LB must pass `Upgrade`/`Connection`, disable response
  buffering, and use an idle timeout longer than the Socket.IO heartbeat. Socket.IO here runs without
  sticky sessions, so **one API instance**.
- **LB health checks:** web on `/` (expect 200), API on `/health` if it is a backend target. Do not
  cache `/sw.js`: `client/next.config.ts` sets `no-cache, no-store, must-revalidate` for it.
- **HTTPS is mandatory for the PWA.** Service worker registration and home-screen install only work
  on a secure origin (`localhost` aside).

No LB, certificate or DNS entry exists yet. HTTPS has never been exercised.

---

## 9. Region: India

- Run web, API, and MySQL in the **same India region and the same VPC**, one instance each for the
  POC (e.g. AWS `ap-south-1` Mumbai, GCP `asia-south1`). The tablets sit on Indian mobile networks;
  keeping API and DB in-country removes a ~120–250 ms round trip per call, which is visible on
  screens that fire several queries per tap.
- Depot data stays in India: hosting the demo DB abroad adds a compliance question for no benefit.
- Keep containers on **UTC** (the default). Do not set `TZ=Asia/Kolkata` — the UI sends
  `YYYY-MM-DD` and the API converts it to depot-local (IST) day bounds in the query layer
  (`server/src/utils/datetime.ts`, covered by five tests in `tests/logs-date.test.ts`). Changing the
  container timezone would shift every stored timestamp and the audit trail instead.
- No CDN or object storage is needed: static assets ship in the web image, exports are streamed
  responses.

---

## 10. Migrations on start

```dockerfile
# server/Dockerfile (final stage)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

Every API start applies pending migrations before the process listens. There is one
squashed init migration:

| Migration | Adds |
| --- | --- |
| `20261029110447_init` | Full schema, including `users.isActive` for user management and `stock_ledger.reason VARCHAR(255)`. |

`prisma migrate status` is clean on the dev database. Behaviour and consequences:

- Startup order is already correct: `depends_on: condition: service_healthy` on MySQL means the
  container starts only after `mysqladmin ping` passes, then `prisma migrate deploy` applies the
  schema.
- A failing migration exits non-zero → `restart: always` → crash loop. The Prisma error (`P3009`,
  `SQLSTATE`, …) is the first line in `docker compose logs api`.
- **Single instance assumption.** Two API replicas starting together both run `migrate deploy`
  against the same schema, which can fail one of them; Socket.IO without sticky sessions already
  caps the POC at one API container. If you scale out, move migrations to a one-shot
  `docker compose run --rm api npx prisma migrate deploy` step before the rolling update and keep the
  CMD as a no-op guard.
- **No down migrations.** Prisma migrations here are forward-only. Snapshot the DB before deploying a
  schema change; recovery is restore plus a forward fix.
- **Seeding is never automatic.** `prisma/seed.ts` is not run by the image (it would rewrite demo
  data on every boot) and refuses to run under `NODE_ENV=production` without the four
  `SEED_*_PASSWORD` values, or with `--reset` unless `ALLOW_DESTRUCTIVE_SEED=1`. The runtime image
  cannot seed as-is either: `tsx` is a devDependency removed by `npm prune --omit=dev` and
  `prisma/seed.ts` is not part of the `tsconfig.build.json` output — seed from a checkout or a
  build-stage image.

---

## 11. Remaining gaps

Verified against the current tree on 2026-10-30. [`docs/project-status.md`](./project-status.md) holds
the review-time list; items closed during this pass are at the end of this section.

| # | Gap | Effect today | Required fix |
|---|---|---|---|
| 11.1 | **The API port is published in production.** `docker-compose.prod.yml` maps `5000:5000` and does not pass `TRUST_PROXY` (default `0`). | Anyone who finds the host can call the API directly. Once the API is put behind the LB with `TRUST_PROXY=1` set, the still-published port makes `X-Forwarded-For` spoofable and defeats the rate limiters. | Remove the `api` `ports:` entry (keep it on the internal network for `web` and the LB) or bind it to `127.0.0.1`, then add `TRUST_PROXY: "1"` to the api environment. |
| 11.2 | **No TLS terminator in the stack.** Web is published as plain `3000:3000`; nothing in compose handles HTTPS, redirects, or the `/socket.io` upgrade. | A tablet install over plain HTTP will not register a service worker, and tokens travel in clear text. | Put an LB/reverse proxy in front (managed LB, Caddy, nginx) terminating TLS and proxying to `web:3000`; stop publishing `web` on a public interface. |
| 11.3 | **Containers run as root.** Neither Dockerfile has a `USER`. | A compromised process has root inside the container. | Add a non-root user in both runner stages (`useradd` + `USER`, `chown` the app dir). |
| 11.4 | **Node 20 base images** (`node:20-slim`) vs the Node 22 toolchain everything was verified on (v22.23.2, `engines: >=20`). | Builds and runtime may differ from the verified environment. | Pin both images to a specific Node 22 tag. |
| 11.5 | **Migrations run inside the API container** with no lock coordination between replicas. | Safe at one replica; unsafe the moment a second one starts. | One-shot migrate job, or keep the single-instance rule explicit. |
| 11.6 | **Seeding cannot run inside the runtime image** (`tsx` pruned, `seed.ts` not compiled). | No supported way to (re)seed a deployed stack without a local checkout plus network access to the DB. | Compile the seed (`tsconfig.build.json` include, tsx-free entrypoint) or ship a documented one-shot seed container. |
| 11.7 | **Merging the compose files is a trap.** `docker compose -f docker-compose.yml -f docker-compose.prod.yml …` keeps the dev file's `3306:3306`, its `env_file: ./server/.env`, and its credentials. | MySQL ends up public and the API silently inherits developer secrets. | Run `docker-compose.prod.yml` alone; it is self-contained by design. If you must override, restate `ports: []`. |
| 11.8 | **Dependency advisories.** `npm audit --omit=dev` reports 5 advisories (3 high, 2 moderate) from Prisma's `deepmerge-ts` and ExcelJS's `uuid`; both are transitive and there is no non-breaking upgrade today. | Unpatched transitive packages ship in the api image. | Track upstream releases; upgrade Prisma/ExcelJS when a compatible fix lands; re-run `npm audit --omit=dev` before any real deployment. |
| 11.9 | **Build hygiene residual.** `client/Dockerfile` still runs `COPY . .` after `npm ci`; mitigated by `client/.dockerignore`, but the ordering lets a host `node_modules` win if that file is ever removed. | Slower, less reproducible builds. | Keep the per-context `.dockerignore` files; optionally copy sources before `npm ci` with a lockfile-only layer. |
| 11.10 | **Nothing is deployed.** No image build, no `up`, no host, no DNS, no certificate, no public URL, no tablet install. | The whole production path is unproven. | Build both images, start the prod file on a host with real secrets, terminate TLS at an LB, install the PWA on a tablet. |

Closed in this pass (verified in the current tree, listed so nobody re-fixes them):

- `NEXT_PUBLIC_*` build args in `client/Dockerfile` plus required `build.args` in both compose files.
- Compose healthchecks and `condition: service_healthy` for `api` and `web`; MySQL unpublished in the
  prod file.
- Prod compose is self-contained and its `config` validates with dummy secrets.
- Per-context `client/.dockerignore` and `server/.dockerignore`.
- `SEED_*_PASSWORD` no longer required at production boot; `assertProductionEnv()` only enforces
  `JWT_SECRET` and `CORS_ORIGIN`.
- `--reset` production guard (`ALLOW_DESTRUCTIVE_SEED=1`) implemented in `prisma/seed.ts`.
- Configurable `TRUST_PROXY` (default `0`).
- Three migrations applied cleanly; `init` unchanged.
- Both packages build: server `tsc` build (74 lint files) and client `next build` with
  `output: "standalone"` (69 lint files, Next 16.4.3).

Every item in §11 is still **unverified by an actual Docker build or deployment**.
