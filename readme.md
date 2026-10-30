# DMS Depot — Depot Management System (POC)

> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

Proof of concept for **one ammunition depot**: three browser tablets (an installable web app) replace the
phone calls and paper slips between the gate, the sheds and the office, and stay in sync live.

## Three roles, one loop
| Role | Who | Does |
| --- | --- | --- |
| `ADMIN` | depot officer | inventory, stock-in/adjust, logs + CSV/Excel export, users |
| `GATE` | gate security | register an arriving vehicle + requirement lines, check out |
| `SHED` | storekeeper, one login per shed | own incoming queue, confirm loaded qty, own stock |

1. The gate registers a vehicle with item lines.
2. Each line routes to the shed holding the item, and only that shed is alerted.
3. The shed confirms the quantity actually loaded → stock and the ledger update.
4. The gate checks out — allowed only after every shed has finished.

A vehicle can need two sheds; each confirms its own lines. Short stock is a **warning only**.
Stack: Next.js 16 PWA · Express 5 + Prisma 6 + MySQL 8.4 · Socket.IO hints · JWT — see `@docs/01-architecture.md`.

## Quickstart (local)
Node 20+ (developed on 22), npm and Docker. Put the project Node on PATH first:

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH

docker compose up -d mysql          # 1. MySQL 8.4 on :3306 — db dms, user dms / dms
cp server/.env.example server/.env  # 2. env; set JWT_SECRET to 32+ random chars
cp client/.env.example client/.env.local
(cd server && npm install)          # 3. install
(cd client && npm install)
cd server && npx prisma migrate deploy && npm run db:seed   # 4. schema + demo data (-- --reset wipes)
npm run dev                         # 5. API + Socket.IO on :5000 (health at /health)
cd ../client && npm run dev         # 6. web app on :3000
```

Env vars, test DB, seed logins and production deploy: `@docs/04-setup-and-deploy.md`.

## Demo logins
Four seeded accounts: `admin`, `gate`, `sheda` (SHED-A), `shedb` (SHED-B). Dev passwords and
`SEED_*_PASSWORD` overrides: `@docs/04-setup-and-deploy.md` §8.

## Layout
```text
rit/
  index.md · agents.md    topic → file:line map · working instructions
  server/ · client/       Express API + Socket.IO · Next.js 16 PWA
  docker-compose.yml      local stack;  .prod.yml = self-contained demo stack
  docs/                   reference set — see @index.md
```

Status and test results: `@docs/project-status.md` (uncommitted working tree).

Related: @index.md, @agents.md
