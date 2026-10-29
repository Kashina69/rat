# Phase 01 — Foundation + Docker MySQL + Auth

Goal: runnable base. Docker MySQL up, Prisma connected, login works, folder structure fixed. Stop after this and review structure before Phase 02.

## 1. MySQL via Docker only

- Do NOT install MySQL locally.
- Create `docker-compose.yml` at repo root:

```yaml
services:
  mysql:
    image: mysql:8.4
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: dms
      MYSQL_USER: dms
      MYSQL_PASSWORD: dms
    ports:
      - "3306:3306"
    volumes:
      - dms-mysql:/var/lib/mysql
volumes:
  dms-mysql:
```

- Run: `docker compose up -d`, verify: `docker compose ps`
- `server/.env`: `DATABASE_URL="mysql://dms:dms@localhost:3306/dms"`
- Add `JWT_SECRET` (long random, dev only), `JWT_EXPIRES_IN=8h`, `CORS_ORIGIN=http://localhost:3000`

## 2. Backend deps

- `server`: add `prisma @prisma/client socket.io jsonwebtoken bcryptjs zod`
- Keep existing `app.ts`, `index.ts`, `env.ts` — extend, don't rewrite.

## 3. Folder structure to create and verify

Create exactly this, nothing extra:

```text
server/src/
  config/env.ts, config/db.ts, config/socket.ts (stub, real work in Phase 03)
  middlewares/auth.ts, middlewares/requireRole.ts, middlewares/validate.ts, middlewares/errorHandler.ts, middlewares/rateLimit.ts
  utils/password.ts, utils/jwt.ts, utils/asyncHandler.ts, utils/responses.ts
  validators/auth.schemas.ts
  modules/auth/auth.routes.ts, modules/auth/auth.controller.ts, modules/auth/auth.service.ts
  types/domain.ts, types/express.d.ts
  app.ts, index.ts
server/prisma/schema.prisma, server/prisma/seed.ts
```

- Rules: pure functions only, no classes. route → controller → service → prisma.
- Response shape: `{ data }` / `{ error: { code, message } }`.

## 4. Prisma schema (final, includes P0 fixes)

- `User`: id, name, username unique, passwordHash, role ADMIN|GATE|SHED, shedId? FK
- `Shed`: id, name, code unique
- `Item`: id, name, category, unit, shedId FK, currentStock, reorderLevel, isActive (archive, no hard delete). No `currentStock` in generic update API.
- `Visit`: id, vehicleNumber, driverName, party, status, arrivalAt, checkoutAt?, gateUserId FK, checkoutByUserId?, cancelledAt?
- Visit status: `AWAITING_LOADING | PARTIALLY_LOADED | READY_FOR_CHECKOUT | CHECKED_OUT | CANCELLED`. No `REGISTERED`.
- `RequirementLine`: id, visitId FK, itemId FK, shedId FK (frozen at creation), requestedQty, loadedQty?, status PENDING|LOADED|CANCELLED, confirmedByUserId?, confirmedAt?. Unique `(visitId, itemId)`.
- `StockLedger`: id, itemId FK, requirementLineId? unique, visitId?, actorUserId FK, type OPENING|IN|OUT|ADJUST, delta signed int, balanceAfter int, reason?, createdAt. Append-only, no update/delete API.
- Invariant: `Item.currentStock = SUM(StockLedger.delta)`.
- `AuditEvent`: id, userId FK, action, entity, entityId, createdAt.
- Indexes: Visit(status), RequirementLine(visitId, shedId, status), StockLedger(itemId, createdAt), Item(shedId).

## 5. Auth

- bcrypt 12 rounds. Seed users via hash, dev-only passwords.
- JWT access-only, 8h, payload: userId, role, shedCode?. In-memory on client (Phase 04).
- `auth` middleware verifies JWT → req.user. `requireRole()` guards routes.
- Login: generic error for bad user/pass, rate-limit by IP+username, never log secrets.
- Shed scoping enforced server-side. Frontend RoleGuard is UX only.

## 6. Seed

- 2 sheds: SHED-A, SHED-B.
- ~10 items split across sheds, with OPENING ledger rows.
- 4 users: admin, gate, shedA (shedId=A), shedB (shedId=B).

## Verify before Phase 02

- [ ] `docker compose up -d` healthy, migrate + seed clean
- [ ] `POST /api/auth/login` returns token, `GET /api/auth/me` 200 with token / 401 without / 403 cross-role
- [ ] Folder tree matches section 3 exactly
- [ ] `typecheck + lint` clean
- [ ] Stop, review structure, then start Phase 02.
