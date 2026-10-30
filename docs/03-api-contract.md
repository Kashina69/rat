> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

# 03 — API Contract

The API as implemented today in `server/src/modules/**` and
`server/src/config/socket.ts`; nothing here is aspirational. Field rules, enums
and invariants: @docs/02-data-model.md. Open items: @docs/project-status.md.

## Conventions

| Item | Rule |
| --- | --- |
| Base path | `/api`, unversioned. Health sits outside it at `/health` |
| Transport | JSON in, JSON out; bodies capped at 100 kB (`express.json`) |
| Success | `{ data: ... }` — object or array under `data` |
| Paginated | `{ data: [...], pagination: { page, limit, totalItems, totalPages } }` — `GET /api/logs` only |
| Error | `{ error: { code: "MACHINE_CODE", message: "human text" } }` |
| Auth header | `Authorization: Bearer <jwt>` on every route except `POST /api/auth/login` and `GET /health` |
| Token | JWT HS256, payload `{ userId, role, shedCode? }`, life `JWT_EXPIRES_IN` (default `8h`); access only, no refresh or revocation, client keeps it in memory |
| Roles | `ADMIN`, `GATE`, `SHED`, enforced by `requireRole`; the client's role guard is UX only |
| Validation | Zod at every boundary; first issue → `400 VALIDATION_ERROR` |
| Content type | JSON everywhere except `GET /api/logs/export` (`text/csv; charset=utf-8`) and `GET /api/logs/export.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) |
| CORS | Exact-origin allowlist from `CORS_ORIGIN` via `isOriginAllowed` |
| Rate limits | `/api` → 300 req/min per IP; `POST /api/auth/login` → 10 attempts/min per IP+username; over the limit `429 RATE_LIMITED` |
| Booleans | `includeInactive` accepts exactly `true`/`false`/`1`/`0`; every other boolean field must be a JSON boolean |
| Shed scoping | Server-side in the services: `GET /api/items`, `GET /api/dashboard`, `GET /api/sheds/:code/queue`, `POST /api/requirement-lines/:id/confirm` reject a `SHED` caller with no shed or another shed's request (`403 CROSS_SHED`) |

## Error codes

| Code | HTTP | Emitted by |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | body/query Zod validation |
| `INVALID_JSON` | 400 | malformed JSON body (`entity.parse.failed`) |
| `INVALID_ID` | 400 | non-numeric or `<= 0` `:id` |
| `UNAUTHORIZED` | 401 | missing/malformed header, bad or expired token, deleted user |
| `INVALID_CREDENTIALS` | 401 | unknown username, wrong password, or disabled account |
| `FORBIDDEN` | 403 | role not allowed by `requireRole` |
| `ACCOUNT_DISABLED` | 403 | valid token for a user with `isActive = false` |
| `FORBIDDEN_ORIGIN` | 403 | CORS rejection |
| `NOT_FOUND` | 404 | unknown route; Prisma `P2025` |
| `DUPLICATE` | 409 | Prisma `P2002` (unique violation) |
| `CONFLICT` | 409 | Prisma `P2003` (FK conflict) |
| `REQUEST_TOO_LARGE` | 413 | body over 100 kB (`entity.too.large`) |
| `RATE_LIMITED` | 429 | rate limiters |
| `INTERNAL_ERROR` | 500 | unhandled error, including DB outage (details only in the server log) |

Domain codes appear with their endpoints. `401`/`403 ACCOUNT_DISABLED` apply to
every authenticated route and are not repeated per row.

## Auth

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/auth/login` | public (10/min) | `{ username: 1..120, password: 1..256 }` | 200 `{ data: { token, user: { id, name, username, role, shedId, shedCode } } }` | 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS`, 429 `RATE_LIMITED` |
| GET | `/api/auth/me` | any authenticated | — | 200 `{ data: { id, name, username, role, shedId, shedCode } }` | 401, 403 `ACCOUNT_DISABLED` |

A disabled account fails login with the same `401 INVALID_CREDENTIALS` as a wrong
password — the response never reveals that the account exists. `shedCode` is
joined from `sheds` and is `null` for `ADMIN`/`GATE`.

## Users

The whole router is `auth` + `requireRole("ADMIN")`, so `403 FORBIDDEN` is
possible on every row. The user DTO is exactly `{ id, name, username, role,
shedId, isActive, shed }` where `shed` is `{ code, name }` or `null`;
`passwordHash` is never selected into a response.

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/users` | `ADMIN` | none; no pagination | 200 `ManagedUser[]` — `role` asc then `username` asc; disabled rows included with `isActive: false` | 403 |
| POST | `/api/users` | `ADMIN` | `name` 1..120, `username` 3..64 unique, `password` 8..72 (bcrypt 12), `role`, `shedId` required for `SHED`, forbidden for `ADMIN`/`GATE` | 201 `ManagedUser` (`isActive: true`) | 400 `VALIDATION_ERROR`, 400 `SHED_REQUIRED`, 404 `SHED_NOT_FOUND`, 409 `DUPLICATE` |
| PATCH | `/api/users/:id` | `ADMIN` | optional `name` 1..120, `role`, `shedId` positive or null, `isActive` (JSON boolean) | 200 `ManagedUser` | 400 `INVALID_ID`, 400 `VALIDATION_ERROR`, 400 `SHED_REQUIRED`, 400 `SHED_NOT_ALLOWED`, 404 `USER_NOT_FOUND`, 404 `SHED_NOT_FOUND`, 409 `CANNOT_DISABLE_SELF` |
| POST | `/api/users/:id/reset-password` | `ADMIN` | `{ password: 8..72 }`, no old password | 200 `ManagedUser` | 400 `INVALID_ID`, 400 `VALIDATION_ERROR`, 404 `USER_NOT_FOUND` |

Rules to expect: a role change to `ADMIN`/`GATE` clears `shedId` to `null`
automatically, and sending a non-null `shedId` with such a role is
`400 SHED_NOT_ALLOWED` (or `400 VALIDATION_ERROR` when both arrive together);
`SHED` needs a shed, sent or already on the record, else `400 SHED_REQUIRED`;
`isActive: false` on your own id is `409 CANNOT_DISABLE_SELF`. Each change writes
one audit row in the same transaction and emits no socket event. Disabling or
resetting a password does not revoke tokens: REST fails on the next request with
`403 ACCOUNT_DISABLED`, while an open socket survives until its expiry timer.

## Visits

Visit DTO: `{ id, vehicleNumber, driverName, party, status, arrivalAt, checkoutAt,
cancelledAt, gateUser, checkoutByUser, lines[] }`; line DTO: `{ id, visitId,
itemId, shedId, requestedQty, loadedQty, status, confirmedAt, confirmedBy, item,
shed, shortfall, display }` — computed fields per @docs/02-data-model.md.

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/visits` | `GATE`, `ADMIN` | `vehicleNumber` 1..20, `driverName` 1..120, `party` 1..120, `lines[]` ≥1 of `{ itemId positive, qty 1..1,000,000 }` | 201 `{ data: { visit, warnings: [{ itemId, requested, available }] } }` | 400 `VALIDATION_ERROR`, 400 `DUPLICATE_LINE`, 404 `ITEM_NOT_FOUND`, 409 `ITEM_INACTIVE` |
| GET | `/api/visits?status=inside` | `GATE`, `ADMIN` | `status` — only `inside` accepted | 200 `Visit[]`, newest `arrivalAt` first, **not paginated** | 400 `VALIDATION_ERROR` |
| POST | `/api/visits/:id/cancel` | `GATE`, `ADMIN` | none | 200 `Visit` with `status = "CANCELLED"` | 400 `INVALID_ID`, 404 `VISIT_NOT_FOUND`, 409 `ALREADY_CHECKED_OUT`, 409 `ALREADY_CANCELLED`, 409 `HAS_LOADED_LINES` |
| POST | `/api/visits/:id/checkout` | `GATE`, `ADMIN` | none | 200 `Visit` with `status = "CHECKED_OUT"`, `checkoutAt`, `checkoutByUser` | 400 `INVALID_ID`, 404 `VISIT_NOT_FOUND`, 409 `ALREADY_CHECKED_OUT`, 409 `VISIT_CANCELLED`, 409 `NOT_READY`, 409 `NOTHING_LOADED` |

Registration derives one `PENDING` line per item with `shedId` frozen from the
item; the visit starts `AWAITING_LOADING` and no stock moves. `warnings` lists
every line where `qty > currentStock` and never blocks the save. Visit cancel also
cancels every `PENDING` line and sets `cancelledAt`, never rolling back loaded
stock (`409 HAS_LOADED_LINES`). Checkout is strict, only from
`READY_FOR_CHECKOUT` via a conditional `updateMany`; `409 NOTHING_LOADED` means
every line was cancelled.

## Requirement lines

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/requirement-lines/:id/cancel` | `GATE`, `ADMIN` | none; `PENDING` lines only | 200 `RequirementLine`; visit status recomputed (`CANCELLED` if every line ends cancelled) | 400 `INVALID_ID`, 404 `LINE_NOT_FOUND`, 404 `VISIT_NOT_FOUND`, 409 `VISIT_CLOSED`, 409 `ALREADY_RESOLVED` |
| POST | `/api/requirement-lines/:id/confirm` | `SHED`, `ADMIN` | `{ loadedQty }` — int 1..1,000,000 by schema, and `1..requestedQty` in the service | 200 `RequirementLine` | 400 `INVALID_ID`, 400 `VALIDATION_ERROR`, 400 `INVALID_QTY`, 403 `FORBIDDEN`, 403 `CROSS_SHED`, 404 `LINE_NOT_FOUND`, 404 `VISIT_NOT_FOUND`, 404 `ITEM_NOT_FOUND`, 409 `VISIT_CHECKED_OUT`, 409 `VISIT_CANCELLED`, 409 `ALREADY_CONFIRMED` |

Confirm, in one transaction: line → `LOADED` with `loadedQty`, `confirmedBy`,
`confirmedAt`; item stock `-loadedQty`; one `OUT` ledger row; visit status
recomputed. There is **no on-hand stock block** — exceeding `currentStock`
succeeds and stock goes negative — and an archived item can still be confirmed,
so archiving never strands a live visit. A second confirm is `409
ALREADY_CONFIRMED` with no state change; stock-mutating transactions retry once on
deadlock `P2034` (`withDeadlockRetry`). `409 VISIT_CLOSED` means the visit is
already checked out or cancelled.

## Sheds

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/sheds` | `ADMIN`, `GATE`, `SHED` | none | 200 `[{ id, name, code }]` ordered by `code` | 401 |
| GET | `/api/sheds/:code/queue` | `SHED`, `ADMIN` | `:code` = shed code (`SHED-A`); a `SHED` caller may only use its own | 200 `{ data: { shed: { id, name, code }, lines: [...] } }` — `PENDING` lines on open visits, oldest `arrivalAt` first, each line carrying its `visit { id, vehicleNumber, driverName, party, status, arrivalAt }`; not paginated | 400 `INVALID_CODE`, 403 `CROSS_SHED`, 404 `SHED_NOT_FOUND` |

## Items

Item DTO: `{ id, name, category, unit, shedId, currentStock, reorderLevel,
isActive, shed: { id, name, code } }`.

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/items?shed=&includeInactive=` | `ADMIN`, `GATE`, `SHED` | `shed` = shed **code** filter; `includeInactive` adds archived rows | 200 `Item[]` ordered by `shedId` then `name`; not paginated | 400 `VALIDATION_ERROR`, 403 `CROSS_SHED` |
| POST | `/api/items` | `ADMIN` | `name` 1..120, `category` 1..120, `unit` 1..40, `shedId` positive, `currentStock` 0..1,000,000 (default 0), `reorderLevel` 0..1,000,000 (default 0) | 201 `Item`; also writes an `OPENING` ledger row | 400 `VALIDATION_ERROR`, 404 `SHED_NOT_FOUND` |
| PUT | `/api/items/:id` | `ADMIN` | only `name`, `category`, `reorderLevel`, `isActive`; `unit`, `shedId` and stock are not editable | 200 `Item` | 400 `INVALID_ID`, 400 `VALIDATION_ERROR`, 404 `ITEM_NOT_FOUND` |
| DELETE | `/api/items/:id` | `ADMIN` | none; archive-first | 200 `{ data: { archived: boolean, item } }` | 400 `INVALID_ID`, 404 `ITEM_NOT_FOUND` |
| POST | `/api/items/:id/stock-in` | `ADMIN` | `qty` int 1..1,000,000; `reason` optional ≤255 (default `Stock in`) | 200 `Item`; writes `IN` ledger row `+qty` | 400 `INVALID_ID`, 400 `VALIDATION_ERROR`, 404 `ITEM_NOT_FOUND`, 409 `ITEM_INACTIVE` |
| POST | `/api/items/:id/adjust` | `ADMIN` | `qty` int −1,000,000..1,000,000, never 0; `reason` required 1..255 | 200 `Item`; writes `ADJUST` ledger row with the signed delta | 400 `INVALID_ID`, 400 `VALIDATION_ERROR`, 400 `INVALID_QTY`, 404 `ITEM_NOT_FOUND`, 409 `ITEM_INACTIVE`, 409 `NEGATIVE_STOCK` |

A `SHED` caller is always scoped to its own shed: `shed` may be omitted or must
equal its code. Archive semantics and the `includeInactive` rule:
@docs/02-data-model.md. Item create, update, stock-in and adjust emit
`stock.updated` + `inventory.changed`.

## Logs

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/logs` | `ADMIN` | `vehicle` (substring), `item` (int), `shed` (code), `status` (`PENDING`/`LOADED`/`CANCELLED`), `from`, `to`, `page` (min 1, default 1), `limit` (1..200, default 50) | 200 paginated: one row per requirement line, newest `arrivalAt` first | 400 `VALIDATION_ERROR` |
| GET | `/api/logs/export` | `ADMIN` | same filters minus `page`/`limit`; whole filtered set | 200 `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="logs.csv"` | 400 `VALIDATION_ERROR` |
| GET | `/api/logs/export.xlsx` | `ADMIN` | same filters and order as CSV | 200 workbook bytes, `filename="logs.xlsx"` | 400 `VALIDATION_ERROR` |

Row shape: `{ lineId, vehicle, driver, party, arrival, arrivalIST, checkout,
checkoutIST, visitStatus, shed, shedName, item, requested, loaded, shortfall,
lineStatus, display, gateUser, confirmedBy, confirmedAt, confirmedAtIST }`. `*IST`
fields are `Asia/Kolkata` `YYYY-MM-DD HH:mm:ss` strings, empty when null;
`totalPages` is `max(1, ceil(totalItems / limit))`. `from`/`to` take a `YYYY-MM-DD`
day or any `Date.parse`-able timestamp; a plain day is an **IST calendar day**
(`from` = 00:00:00 IST, `to` = 23:59:59.999 IST).

CSV: UTF-8 **with BOM**, CRLF, every cell quoted with doubled inner quotes, and a
cell starting with `= + - @` (after stripping leading whitespace/control chars)
prefixed with `'` to block formula injection. XLSX (ExcelJS 4.4.0): one `Logs`
worksheet, bold frozen header (`ySplit: 1`), fixed widths, numbers as numbers, no
formula cells. Both share 18 columns in this order: Vehicle, Driver, Party,
Arrival (IST), Checkout (IST), Visit Status, Shed, Item, Category, Unit, Requested,
Loaded, Shortfall, Line Status, Display, Gate User, Confirmed By, Confirmed At
(IST) — nulls render empty, users print `username`.

## Dashboard and health

| Method | Path | Roles | Body / query | Success | Key errors |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/dashboard` | `ADMIN`, `GATE`, `SHED` | none | 200 `{ data: { insideCount, perShedPending: [{ shedId, shedCode, shedName, pendingLines }], lowStock: [Item] } }` | 403 `CROSS_SHED` |
| GET | `/health` | public | none; outside `/api`, no rate limit | 200 `{ data: { status: "ok", uptime } }` | — |

`insideCount` counts visits not `CHECKED_OUT`/`CANCELLED` (for `SHED`, only visits
with a line for that shed). `perShedPending` counts `PENDING` lines on open visits
grouped by the line's frozen shed. `lowStock` is active items with
`currentStock <= reorderLevel`, ascending by `currentStock`; no full per-shed
stock list exists (@docs/project-status.md).

## Socket contract

Socket.IO rides the same HTTP server (`server/src/config/socket.ts`). Events are
**invalidation hints only**: payloads carry ids and timestamps, never changed
data, and inventory is committed before any emit — a socket failure never rolls
back stock.

Handshake: `io(SOCKET_URL, { auth: { token: "<jwt>" } })`. A missing, invalid or
expired token, or a deleted user, rejects the connection with `UNAUTHORIZED`. On
connect the user is reloaded from the DB and joined to exactly **one** room by
role; a `SHED` user without a shed code is disconnected immediately. At token
expiry a timer emits `session.expired` to that socket and disconnects it — no
re-auth, no reconnect with a dead token.

| Room | Joined by |
| --- | --- |
| `gate` | `GATE` |
| `admin` | `ADMIN` |
| `shed:{code}` (e.g. `shed:SHED-A`) | `SHED` bound to that shed |

| Event | Emitted when | Rooms | Payload |
| --- | --- | --- | --- |
| `requirement.created` | visit registered | `gate`, `admin`, each shed on the visit | `{ visitId, at }` |
| `loading.confirmed` | line confirmed | `gate`, `admin`, each shed on the visit | `{ lineId, visitId, itemId, at }` |
| `visit.statusChanged` | registration, confirm, line cancel, visit cancel, checkout | `gate`, `admin`, every shed on the visit | `{ visitId, status, at }` |
| `stock.updated` | confirm, item create/update, stock-in, adjust | `gate`, `admin`, the item's shed | `{ itemId, at }` |
| `inventory.changed` | item create, stock-in, adjust, confirm | `gate`, `admin`, the item's shed | `{ itemId, at }` |
| `session.expired` | that socket's token expiry timer fires | the single socket (`socket.emit`, not a room) | `{ at }` (epoch ms) |

`at` is an ISO-8601 string on invalidation events and epoch milliseconds on
`session.expired`; `status` is the visit status at emit time. Visit events use
`roomsForSheds` (gate + admin + every shed involved); item events go to gate +
admin + the item's shed only.

`client/src/providers/socket-provider.tsx` is the only listener owner: on
`session.expired` (or a `UNAUTHORIZED` `connect_error`) it removes all listeners,
disconnects, calls `logout()` — dropping the in-memory token and **clearing the
TanStack Query cache** — shows "Session expired. Sign in again." and returns to
login. No reconnect with the dead token, so a shared tablet cannot show a previous
user's data. Every invalidation event triggers a cache invalidation and refetch;
reconnect refetches everything.

Related: @docs/01-architecture.md, @docs/02-data-model.md, @docs/04-setup-and-deploy.md
