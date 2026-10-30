# API Contract

Everything below describes the API as **implemented today** in
`server/src/modules/**`. Nothing here is aspirational. §12 lists the items that
are still open or unverified, and links to `docs/project-status.md`.

Decisions behind this contract: `docs/decisions_made.md`. Field-level rules:
`docs/02-data-model.md`.

## 1. Conventions

| Item | Rule |
|---|---|
| Base path | `/api` (unversioned). Health check lives outside it at `/health`. |
| Transport | JSON in, JSON out. Request bodies limited to 100 kB (`express.json`). |
| Success shape | `{ "data": ... }` — single object or array payload under `data` |
| Paginated shape | `{ "data": [...], "pagination": { page, limit, totalItems, totalPages } }` — used by `GET /api/logs` only |
| Error shape | `{ "error": { "code": "MACHINE_CODE", "message": "human text" } }` |
| Auth header | `Authorization: Bearer <jwt>` on every route except `POST /api/auth/login` and `GET /health` |
| Token | JWT HS256, payload `{ userId, role, shedCode? }`, default life `8h` (`JWT_EXPIRES_IN`). Access-only: no refresh, no revocation. Client keeps it in memory only. |
| Roles | `ADMIN`, `GATE`, `SHED`. Enforced server-side by `requireRole`. |
| Validation | Zod at every input boundary; failure → `400 VALIDATION_ERROR` with the first issue message |
| Content type | JSON everywhere, except `GET /api/logs/export` (`text/csv; charset=utf-8`) and `GET /api/logs/export.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) |
| CORS | Explicit allowlist from `CORS_ORIGIN` (`isOriginAllowed`) |
| Rate limits | `/api` → 300 requests/min per IP; `POST /api/auth/login` → 10 attempts/min per `IP+username`. Over the limit returns `429 RATE_LIMITED`. |
| Booleans in query/body | Only `listItemsQuerySchema.includeInactive` takes a free-form flag and it accepts exactly `true`/`false`/`1`/`0`; every other boolean body field must be a JSON boolean |

Shed scoping is a server responsibility and is enforced in the services:
`GET /api/items`, `GET /api/dashboard`, `GET /api/sheds/:code/queue` and
`POST /api/requirement-lines/:id/confirm` all reject a `SHED` caller that has no
shed or asks for another shed (`403 CROSS_SHED`).

## 2. Global error codes

| Code | HTTP | Emitted by |
|---|---|---|
| `VALIDATION_ERROR` | 400 | body/query Zod validation |
| `INVALID_JSON` | 400 | malformed JSON body (`entity.parse.failed`) |
| `INVALID_ID` | 400 | non-numeric or `<= 0` `:id` path param |
| `UNAUTHORIZED` | 401 | missing/malformed `Authorization`, bad or expired token, deleted user |
| `INVALID_CREDENTIALS` | 401 | login with unknown username, wrong password, or a disabled account |
| `FORBIDDEN` | 403 | role not allowed by `requireRole` ("Insufficient permissions") |
| `ACCOUNT_DISABLED` | 403 | valid token for a user whose `isActive` is `false` |
| `FORBIDDEN_ORIGIN` | 403 | CORS rejection (origin not in the allowlist) |
| `NOT_FOUND` | 404 | unknown route; Prisma `P2025` |
| `DUPLICATE` | 409 | Prisma `P2002` (unique violation, e.g. a taken username) |
| `CONFLICT` | 409 | Prisma `P2003` (related-record/FK conflict) |
| `REQUEST_TOO_LARGE` | 413 | body over 100 kB (`entity.too.large`) |
| `RATE_LIMITED` | 429 | rate limiters |
| `INTERNAL_ERROR` | 500 | unhandled error, including a database outage (details only in the server log) |

Domain codes are listed with their endpoints.

## 3. Auth

### `POST /api/auth/login`

Public. Rate-limited (10/min per IP+username).

Body:

```json
{ "username": "gate", "password": "Gate@123-dev-only" }
```

`username` 1..120 chars, `password` 1..256 chars (both required, no trimming).

Success `200`:

```json
{
  "data": {
    "token": "<jwt>",
    "user": { "id": 2, "name": "Gate Clerk", "username": "gate", "role": "GATE", "shedId": null, "shedCode": null }
  }
}
```

A disabled account (`User.isActive = false`) fails with the same
`401 INVALID_CREDENTIALS` as a wrong password — the response never reveals that
the account exists.

Errors: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED`.

### `GET /api/auth/me`

Any authenticated role. No body.

Success `200`: `{ "data": { id, name, username, role, shedId, shedCode } }`.
`shedCode` is joined from `sheds`; `null` for `ADMIN`/`GATE`.

Errors: `401 UNAUTHORIZED`, `403 ACCOUNT_DISABLED`.

## 4. Users (`/api/users`)

The whole router is `auth` + `requireRole("ADMIN")`: every endpoint below is
`ADMIN` only, so `403 FORBIDDEN` is possible everywhere and `401`/`403
ACCOUNT_DISABLED` come from `auth`. `passwordHash` is never returned — the user
DTO is exactly `{ id, name, username, role, shedId, isActive, shed }`, where
`shed` is `{ code, name }` or `null`.

### `GET /api/users`

No query, no pagination. Ordered by `role` ascending (`ADMIN`, `GATE`, `SHED`)
then `username` ascending.

Success `200`:

```json
{
  "data": [
    { "id": 1, "name": "Depot Officer", "username": "admin", "role": "ADMIN",
      "shedId": null, "isActive": true, "shed": null },
    { "id": 4, "name": "Shed A Keeper", "username": "sheda", "role": "SHED",
      "shedId": 1, "isActive": true, "shed": { "code": "SHED-A", "name": "Shed A" } }
  ]
}
```

Disabled users are included with `isActive: false`; the admin screen marks them.

Errors: `401`, `403`.

### `POST /api/users`

Body:

| Field | Type | Rules |
|---|---|---|
| `name` | string | required, 1..120 after trim |
| `username` | string | required, 3..64 after trim, **unique** |
| `password` | string | required, 8..72 (bcrypt limit), hashed with 12 rounds |
| `role` | enum | required: `ADMIN` \| `GATE` \| `SHED` |
| `shedId` | int \| null | required for `SHED`, forbidden (must be absent or `null`) for `ADMIN`/`GATE` |

The role/shed pairing is checked twice: by the request schema (a mismatch is
`400 VALIDATION_ERROR` on the `shedId` path) and again in the service, which
stores `shedId = null` for non-`SHED` roles.

Success `201`: `{ "data": ManagedUser }` with `isActive: true`.

Errors:

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | missing field, short password, `shedId` given for a non-`SHED` role, or missing for `SHED` |
| `SHED_REQUIRED` | 400 | service-level backstop: a `SHED` account with no shed |
| `SHED_NOT_FOUND` | 404 | `shedId` does not exist |
| `DUPLICATE` | 409 | `username` already taken (Prisma `P2002`) |

Side effects: bcrypt hash, `USER_CREATED` audit row in the same transaction. No
socket event is emitted; the admin screen refetches after its own mutation.

### `PATCH /api/users/:id`

All fields optional; only the fields sent are changed.

| Field | Type | Rules |
|---|---|---|
| `name` | string | 1..120 |
| `role` | enum | `ADMIN` \| `GATE` \| `SHED` |
| `shedId` | int \| null | positive int; only valid for the resulting `SHED` role |
| `isActive` | boolean | JSON boolean (not the string `"false"`); `false` disables, `true` enables |

Rules that a client must expect:

- Changing the role to `ADMIN`/`GATE` clears `shedId` to `null` automatically;
  sending a non-null `shedId` with such a role is `400 SHED_NOT_ALLOWED` (or
  `400 VALIDATION_ERROR` when both fields are in the same body).
- Changing the role to `SHED` requires a shed: send `shedId`, or rely on the
  user's existing shed if they already had one. Otherwise `400 SHED_REQUIRED`.
- `isActive: false` on your own account is `409 CANNOT_DISABLE_SELF`.

Success `200`: `{ "data": ManagedUser }` with the new state.

Errors:

| Code | HTTP | When |
|---|---|---|
| `INVALID_ID` | 400 | bad `:id` |
| `VALIDATION_ERROR` | 400 | bad field, wrong boolean type, or `shedId` with a non-`SHED` role in one body |
| `SHED_REQUIRED` | 400 | resulting role is `SHED` but no shed is available |
| `SHED_NOT_ALLOWED` | 400 | `shedId` sent for a user whose (unchanged) role is not `SHED` |
| `USER_NOT_FOUND` | 404 | no such user |
| `SHED_NOT_FOUND` | 404 | `shedId` does not exist |
| `CANNOT_DISABLE_SELF` | 409 | `isActive: false` targeting your own id |

Side effects: one audit row — `USER_DISABLED`, `USER_ENABLED` or `USER_UPDATED`.
A disabled user's existing JWT stops working on the next request
(`403 ACCOUNT_DISABLED`); its already-open socket is not closed until the token
expiry timer fires.

### `POST /api/users/:id/reset-password`

Body: `{ "password": "new-secret-123" }` — 8..72 chars, required. No old
password is needed; this is an admin reset, not a user-initiated change.

Success `200`: `{ "data": ManagedUser }` (no hash, no password echoed).

Errors: `400 INVALID_ID`, `400 VALIDATION_ERROR`, `404 USER_NOT_FOUND`.

Side effects: new bcrypt hash, `USER_PASSWORD_RESET` audit row. Existing tokens
are **not** revoked — there is no revocation list (see
`docs/01-architecture.md`, accepted risks).

## 5. Visits (`/api/visits`)

### `POST /api/visits`

Roles: `GATE`, `ADMIN`.

Body:

```json
{
  "vehicleNumber": "MH 12 AB 1234",
  "driverName": "R. Singh",
  "party": "3 Base Workshop",
  "lines": [ { "itemId": 1, "qty": 40 }, { "itemId": 7, "qty": 10 } ]
}
```

| Field | Type | Rules |
|---|---|---|
| `vehicleNumber` | string | required, 1..20 after trim |
| `driverName` | string | required, 1..120 |
| `party` | string | required, 1..120 |
| `lines` | array | at least 1 entry |
| `lines[].itemId` | int | positive |
| `lines[].qty` | int | 1..1,000,000 |

Server derives one requirement line per item, with `shedId` copied from the item
and `status = PENDING`. Visit starts at `AWAITING_LOADING`. No stock is touched.
Item rows are read before the visit transaction opens (see §12).

Success `201`:

```json
{
  "data": {
    "visit": { "id": 12, "vehicleNumber": "...", "driverName": "...", "party": "...",
               "status": "AWAITING_LOADING", "arrivalAt": "...", "checkoutAt": null,
               "cancelledAt": null, "gateUser": { "id": 2, "name": "...", "username": "gate" },
               "checkoutByUser": null,
               "lines": [ { "id": 30, "visitId": 12, "itemId": 1, "shedId": 1,
                            "requestedQty": 40, "loadedQty": null, "status": "PENDING",
                            "confirmedAt": null, "confirmedBy": null,
                            "item": { "id": 1, "name": "Item A1", "category": "Ammo", "unit": "box",
                                      "currentStock": 100, "shed": { "id": 1, "name": "Shed A", "code": "SHED-A" } },
                            "shed": { "id": 1, "name": "Shed A", "code": "SHED-A" },
                            "shortfall": null, "display": "PENDING" } ] },
    "warnings": [ { "itemId": 1, "requested": 140, "available": 100 } ]
  }
}
```

`warnings` is the short-stock warning: one entry per line where `qty > currentStock`.
It never blocks the save.

Errors: `400 VALIDATION_ERROR`, `400 DUPLICATE_LINE` (same `itemId` twice),
`404 ITEM_NOT_FOUND`, `409 ITEM_INACTIVE` (archived item), `401`, `403`.

### `GET /api/visits?status=inside`

Roles: `GATE`, `ADMIN`. Query: `status` — only `inside` is accepted.

Returns every visit still inside the depot (status not `CHECKED_OUT` /
`CANCELLED`), newest `arrivalAt` first, **not paginated**.

Success `200`: `{ "data": [ Visit, ... ] }` — same `Visit` shape as above.

Errors: `400 VALIDATION_ERROR` (any other `status` value), `401`, `403`.

### `POST /api/visits/:id/cancel`

Roles: `GATE`, `ADMIN`. No body.

Cancels the visit and every line still `PENDING`; sets `cancelledAt`.

Success `200`: `{ "data": Visit }` with `status = "CANCELLED"`.

Errors: `400 INVALID_ID`, `404 VISIT_NOT_FOUND`, `409 ALREADY_CHECKED_OUT`,
`409 ALREADY_CANCELLED`, `409 HAS_LOADED_LINES` (at least one `LOADED` line —
loaded stock is never rolled back).

### `POST /api/visits/:id/checkout`

Roles: `GATE`, `ADMIN`. No body. Strict: only from `READY_FOR_CHECKOUT`, written
with a conditional `updateMany` so a concurrent status change cannot slip through.

Success `200`: `{ "data": Visit }` with `status = "CHECKED_OUT"`, `checkoutAt`
and `checkoutByUser` set.

Errors: `400 INVALID_ID`, `404 VISIT_NOT_FOUND`, `409 ALREADY_CHECKED_OUT`,
`409 VISIT_CANCELLED`, `409 NOT_READY` (a line is still `PENDING`, or the visit
is not in `READY_FOR_CHECKOUT`), `409 NOTHING_LOADED` (every line cancelled).

## 6. Requirement lines (`/api/requirement-lines`)

### `POST /api/requirement-lines/:id/cancel`

Roles: `GATE`, `ADMIN`. No body. Only `PENDING` lines. The visit status is
recomputed afterwards (`CANCELLED` if every line ends up cancelled).

Success `200`: `{ "data": RequirementLine }` — the line DTO shown in §5.

Errors: `400 INVALID_ID`, `404 LINE_NOT_FOUND`, `404 VISIT_NOT_FOUND`,
`409 VISIT_CLOSED` (visit already checked out or cancelled),
`409 ALREADY_RESOLVED` (line is `LOADED` or already `CANCELLED`).

### `POST /api/requirement-lines/:id/confirm`

Roles: `SHED`, `ADMIN`.

Body:

```json
{ "loadedQty": 38 }
```

`loadedQty` int, 1..1,000,000 by schema, and additionally
`1 <= loadedQty <= requestedQty` in the service.

Effects, in one transaction: line → `LOADED` with `loadedQty`, `confirmedBy`,
`confirmedAt`; item stock `-loadedQty`; one `OUT` ledger row; visit status
recomputed. Stock-mutating confirm/checkout transactions are retried once on a
MySQL deadlock (`P2034`, `withDeadlockRetry`).

There is **no on-hand stock block**: if `loadedQty` exceeds `currentStock`, the
confirm still succeeds and `currentStock` goes negative. `loadedQty` is bounded
only by the requested quantity. An archived item can still be confirmed here, so
archiving an item never strands a live visit.

Success `200`: `{ "data": RequirementLine }`.

Errors:

| Code | HTTP | When |
|---|---|---|
| `INVALID_ID` | 400 | bad `:id` |
| `VALIDATION_ERROR` | 400 | `loadedQty` not a positive int |
| `INVALID_QTY` | 400 | `loadedQty` outside `1..requestedQty` |
| `FORBIDDEN` | 403 | caller role is neither `SHED` nor `ADMIN` |
| `CROSS_SHED` | 403 | `SHED` caller confirming another shed's line, or a `SHED` account with no shed |
| `LINE_NOT_FOUND` | 404 | no such line |
| `VISIT_NOT_FOUND` | 404 | orphan line |
| `ITEM_NOT_FOUND` | 404 | item row gone |
| `VISIT_CHECKED_OUT` | 409 | visit already checked out |
| `VISIT_CANCELLED` | 409 | visit cancelled |
| `ALREADY_CONFIRMED` | 409 | line is not `PENDING` — no state change, no double deduction |

## 7. Sheds (`/api/sheds`)

### `GET /api/sheds`

Roles: `ADMIN`, `GATE`, `SHED`. No query.

Success `200`: `{ "data": [ { "id": 1, "name": "Shed A", "code": "SHED-A" }, ... ] }`
ordered by `code`.

### `GET /api/sheds/:code/queue`

Roles: `SHED`, `ADMIN`. `:code` is the shed `code` string (e.g. `SHED-A`).

Returns that shed's live queue: its `PENDING` lines on visits that are still
open, oldest `arrivalAt` first. No pagination. A `SHED` caller may only ask for
its own code, and a `SHED` account without a shed is rejected.

Success `200`:

```json
{
  "data": {
    "shed": { "id": 1, "name": "Shed A", "code": "SHED-A" },
    "lines": [
      { "id": 30, "visitId": 12, "itemId": 1, "shedId": 1,
        "requestedQty": 40, "loadedQty": null, "status": "PENDING",
        "confirmedAt": null, "confirmedBy": null,
        "item": { "id": 1, "name": "Item A1", "category": "Ammo", "unit": "box",
                  "currentStock": 100, "shed": { "id": 1, "name": "Shed A", "code": "SHED-A" } },
        "shed": { "id": 1, "name": "Shed A", "code": "SHED-A" },
        "shortfall": null, "display": "PENDING",
        "visit": { "id": 12, "vehicleNumber": "MH 12 AB 1234", "driverName": "R. Singh",
                   "party": "3 Base Workshop", "status": "AWAITING_LOADING",
                   "arrivalAt": "2026-10-30T06:00:00.000Z" } }
    ]
  }
}
```

Errors: `400 INVALID_CODE` (blank code), `403 CROSS_SHED` (`SHED` asking for a
different code, or a `SHED` account with no shed), `404 SHED_NOT_FOUND`.

## 8. Items (`/api/items`)

### `GET /api/items?shed=<code>&includeInactive=<bool>`

Roles: `ADMIN`, `GATE`, `SHED`.

| Query | Type | Notes |
|---|---|---|
| `shed` | string | shed **code**, filters `shed.code = value` |
| `includeInactive` | flag | `true`/`1` includes archived items; `false`/`0` or absent returns active only. Any other value is `400 VALIDATION_ERROR`. |

A `SHED` caller is always scoped to its own shed: `shed` may be omitted or must
equal the caller's code, anything else is `403 CROSS_SHED`, and a `SHED` account
with no shed is rejected the same way.

Success `200`: `{ "data": [ InventoryItem, ... ] }`, ordered by `shedId` then `name`:

```json
{ "id": 1, "name": "Item A1", "category": "Ammo", "unit": "box", "shedId": 1,
  "currentStock": 100, "reorderLevel": 20, "isActive": true,
  "shed": { "id": 1, "name": "Shed A", "code": "SHED-A" } }
```

Not paginated.

Errors: `400 VALIDATION_ERROR`, `403 CROSS_SHED`, `401`, `403`.

### `POST /api/items`

Roles: `ADMIN`.

Body:

| Field | Type | Rules |
|---|---|---|
| `name` | string | required, 1..120 |
| `category` | string | required, 1..120 |
| `unit` | string | required, 1..40 |
| `shedId` | int | required, positive, must exist |
| `currentStock` | int | optional, 0..1,000,000, default `0` |
| `reorderLevel` | int | optional, 0..1,000,000, default `0` |

Creates the item **and** an `OPENING` ledger row with `delta = currentStock`,
then emits `stock.updated` + `inventory.changed`.

Success `201`: `{ "data": InventoryItem }`.

Errors: `400 VALIDATION_ERROR`, `404 SHED_NOT_FOUND`.

### `PUT /api/items/:id`

Roles: `ADMIN`. Only these fields are accepted; `unit` and `shedId` are not
editable, stock is never editable here.

| Field | Type | Rules |
|---|---|---|
| `name` | string | optional, 1..120 |
| `category` | string | optional, 1..120 |
| `reorderLevel` | int | optional, 0..1,000,000 |
| `isActive` | boolean | optional; `false` archives, `true` restores |

Name, category and reorder level are editable at any time, including after stock
history — there is no "item has history" rejection.

Success `200`: `{ "data": InventoryItem }`.

Errors: `400 INVALID_ID`, `400 VALIDATION_ERROR`, `404 ITEM_NOT_FOUND`.

Side effect: audit `ITEM_ARCHIVED` when the call archives, `ITEM_UPDATED`
otherwise; `stock.updated` + `inventory.changed` are emitted for the item's shed,
`gate` and `admin`.

### `DELETE /api/items/:id`

Roles: `ADMIN`. No body. Archive-first, hard delete only when the item has no
requirement lines and no ledger rows. The usage check runs in its own
transaction before the archive/delete (see §12).

Success `200`:

```json
{ "data": { "archived": true, "item": { "...": "InventoryItem" } } }
```

`archived: false` means the row was physically deleted and `item` is the snapshot
taken before deletion.

Errors: `400 INVALID_ID`, `404 ITEM_NOT_FOUND`.

### `POST /api/items/:id/stock-in`

Roles: `ADMIN`.

Body: `{ "qty": 50, "reason": "Ammunition delivery" }` — `qty` int 1..1,000,000
required; `reason` optional, max 255 (defaults to `Stock in`).

Writes `IN` ledger row `+qty`.

Success `200`: `{ "data": InventoryItem }` with the new `currentStock`.

Errors: `400 INVALID_ID`, `400 VALIDATION_ERROR`, `404 ITEM_NOT_FOUND`,
`409 ITEM_INACTIVE` (archived item).

### `POST /api/items/:id/adjust`

Roles: `ADMIN`.

Body: `{ "qty": -5, "reason": "Damaged in handling" }` — `qty` int
`-1,000,000..1,000,000`, **must not be 0**; `reason` required, 1..255. Signed:
negative reduces stock.

Writes `ADJUST` ledger row with the signed delta.

Success `200`: `{ "data": InventoryItem }`.

Errors:

| Code | HTTP | When |
|---|---|---|
| `INVALID_ID` | 400 | bad `:id` |
| `VALIDATION_ERROR` | 400 | `qty` absent/`0`/out of range, or `reason` missing/too long |
| `INVALID_QTY` | 400 | service-level backstop for `qty === 0` |
| `ITEM_NOT_FOUND` | 404 | no such item |
| `ITEM_INACTIVE` | 409 | item is archived |
| `NEGATIVE_STOCK` | 409 | the adjustment would leave `currentStock` below 0 |

A zero adjustment is refused at both layers, so no no-op ledger rows are written.

## 9. Logs (`/api/logs`)

### `GET /api/logs`

Roles: `ADMIN` only. One row per requirement line, newest visit first.

| Query | Type | Rules |
|---|---|---|
| `vehicle` | string | substring match on `vehicleNumber` |
| `item` | int | exact `itemId` |
| `shed` | string | shed **code** |
| `status` | enum | `PENDING` \| `LOADED` \| `CANCELLED` (line status) |
| `from` | date string | `Date.parse`-able; `arrivalAt >= start of that IST day` |
| `to` | date string | `Date.parse`-able; `arrivalAt <= end of that IST day` |
| `page` | int | min 1, default `1` |
| `limit` | int | 1..200, default `50` |

Success `200` — the only paginated response:

```json
{
  "data": [
    {
      "lineId": 30, "vehicle": "MH 12 AB 1234", "driver": "R. Singh", "party": "3 Base Workshop",
      "arrival": "2026-10-30T06:00:00.000Z", "arrivalIST": "2026-10-30 11:30:00",
      "checkout": null, "checkoutIST": "",
      "visitStatus": "AWAITING_LOADING",
      "shed": "SHED-A", "shedName": "Shed A",
      "item": { "id": 1, "name": "Item A1", "category": "Ammo", "unit": "box" },
      "requested": 40, "loaded": null, "shortfall": null, "lineStatus": "PENDING",
      "display": "PENDING",
      "gateUser": { "id": 2, "name": "Gate Clerk", "username": "gate" },
      "confirmedBy": null, "confirmedAt": null, "confirmedAtIST": ""
    }
  ],
  "pagination": { "page": 1, "limit": 50, "totalItems": 1, "totalPages": 1 }
}
```

Notes: `*IST` fields are `Asia/Kolkata` strings formatted `YYYY-MM-DD HH:mm:ss`,
empty string when the timestamp is null. `totalPages` is
`max(1, ceil(totalItems / limit))`. `shortfall`/`display` are computed, never
stored (see `docs/02-data-model.md` §9).

`from`/`to` accept either a `YYYY-MM-DD` day or any `Date.parse`-able timestamp.
A plain day is treated as an **IST calendar day**: `from=2026-10-30` starts at
`00:00:00 IST` and `to=2026-10-30` ends at `23:59:59.999 IST`, so the whole local
day is included.

Errors: `400 VALIDATION_ERROR` (unparseable date, `limit > 200`, bad `status`),
`401`, `403`.

### `GET /api/logs/export` (CSV)

Roles: `ADMIN`. Same filters as `GET /api/logs` minus `page` and `limit`; exports
the whole filtered result set, rows in the same order (newest `arrivalAt` first,
then line id ascending).

Response `200`, headers `Content-Type: text/csv; charset=utf-8` and
`Content-Disposition: attachment; filename="logs.csv"`.

Body: UTF-8 **with BOM** (`\uFEFF`, written by the controller), CRLF line
endings, every cell quoted, embedded quotes doubled. A cell is prefixed with `'`
to block spreadsheet formula injection when, after stripping leading whitespace
and control characters, it starts with `= + - @`. So `  =cmd` and
`\t=cmd` are neutralised, and the BOM is preserved. Columns, in order:

```
Vehicle, Driver, Party, Arrival (IST), Checkout (IST), Visit Status, Shed, Item,
Category, Unit, Requested, Loaded, Shortfall, Line Status, Display, Gate User,
Confirmed By, Confirmed At (IST)
```

Null `loaded`/`shortfall`/`confirmedBy` render as empty cells. `Gate User` and
`Confirmed By` print the `username`.

Errors: `400 VALIDATION_ERROR`, `401`, `403`. Errors are normal JSON errors, not CSV.

### `GET /api/logs/export.xlsx` (Excel)

Roles: `ADMIN`. Identical filters, columns, IST formatting and row order to the
CSV export — the two share one column definition and one row loader in
`logs/logs.service.ts`.

Response `200`, headers
`Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
and `Content-Disposition: attachment; filename="logs.xlsx"`, body = the workbook
bytes (ExcelJS 4.4.0).

Workbook shape:

- one worksheet named `Logs`;
- row 1 is the header row, bold, frozen (`ySplit: 1`), fixed column widths;
- the same 18 columns in the same order as the CSV;
- empty strings are written as blank cells, `requested`/`loaded`/`shortfall` as
  numbers, everything else as text;
- every cell is a plain value — no formula cells are produced, so a value such as
  `=cmd` can never be evaluated by the spreadsheet.

Errors: `400 VALIDATION_ERROR`, `401`, `403` — JSON, not a workbook.

## 10. Dashboard and health

### `GET /api/dashboard`

Roles: `ADMIN`, `GATE`, `SHED`. A `SHED` caller sees only its own shed's figures
and is rejected with `403 CROSS_SHED` if the account has no shed.

Success `200`:

```json
{
  "data": {
    "insideCount": 3,
    "perShedPending": [ { "shedId": 1, "shedCode": "SHED-A", "shedName": "Shed A", "pendingLines": 2 } ],
    "lowStock": [ { "id": 5, "name": "Item A5", "category": "Shell", "unit": "box",
                    "currentStock": 15, "reorderLevel": 15,
                    "shed": { "id": 1, "name": "Shed A", "code": "SHED-A" } } ]
  }
}
```

`insideCount` = visits not `CHECKED_OUT`/`CANCELLED` (for `SHED`, only visits that
have at least one line for that shed). `perShedPending` counts `PENDING` lines on
open visits, grouped by the line's shed, one entry per shed that has any.
`lowStock` = active items where `currentStock <= reorderLevel`, ascending by
`currentStock`, each with its shed. There is no full per-shed current-stock list
in this payload — see §12.

Errors: `401`, `403`, `403 CROSS_SHED`.

### `GET /health`

Public, outside `/api`. `{ "data": { "status": "ok", "uptime": 123.45 } }`.
No auth, no rate limit.

## 11. Socket contract

Socket.IO on the same HTTP server (`server/src/config/socket.ts`). Events are
**invalidation hints only** — payloads carry ids and timestamps, never the
changed data, and no client state depends on them. Inventory writes are already
committed before any event is emitted; a socket failure never rolls back stock.

### Handshake

```ts
io(SOCKET_URL, { auth: { token: "<jwt>" } })
```

- Missing/invalid/expired token, or a user row that no longer exists → connection
  rejected with `UNAUTHORIZED`.
- On connect, the user is loaded from the DB (fresh `role`, `shedId`, `shedCode`),
  and joined to exactly **one** room by role.
- A `SHED` user without a `shedCode` is disconnected immediately.
- A timer fires at token expiry: it emits `session.expired` to that socket and
  disconnects it. There is no re-auth and no reconnect with a dead token.

### Rooms

| Room | Joined by |
|---|---|
| `gate` | `GATE` |
| `admin` | `ADMIN` |
| `shed:{code}` (e.g. `shed:SHED-A`) | `SHED` bound to that shed |

A shed never receives another shed's room events. The server emits to
`gate` + `admin` + every `shed:{code}` involved in the visit
(`roomsForSheds`), and item/inventory events go to `gate` + `admin` + the item's
own shed.

### Events

| Event | Emitted when | Rooms | Payload |
|---|---|---|---|
| `requirement.created` | visit registered (`POST /api/visits`) | `gate`, `admin`, each shed on the visit | `{ visitId, at }` |
| `loading.confirmed` | line confirmed | `gate`, `admin`, each shed on the visit | `{ lineId, visitId, itemId, at }` |
| `visit.statusChanged` | registration, confirm, line cancel, visit cancel, checkout | `gate`, `admin`, every shed on the visit | `{ visitId, status, at }` |
| `stock.updated` | confirm, item create/update, stock-in, adjust | `gate`, `admin`, the item's shed | `{ itemId, at }` |
| `inventory.changed` | item create, stock-in, adjust, confirm | `gate`, `admin`, the item's shed | `{ itemId, at }` |
| `session.expired` | the per-socket token expiry timer fires | the single socket (direct `socket.emit`, not a room) | `{ at }` (epoch ms, number) |

`at` is an ISO-8601 string on the invalidation events and epoch milliseconds on
`session.expired`. `status` is the visit status at emit time.

### Client side of `session.expired`

`client/src/providers/socket-provider.tsx` is the only listener owner. On
`session.expired` (or a `connect_error` of `UNAUTHORIZED`) it:

1. removes all socket listeners and disconnects;
2. calls `logout()`, which drops the in-memory token **and clears the TanStack
   Query cache**;
3. shows "Session expired. Sign in again." and returns the user to the login
   screen.

No reconnect is attempted with the expired token, so a shared tablet cannot show
a previous user's cached data or keep a zombie socket.

## 12. Current deviations and open items

These are the only items still open as of 2026-10-30. Everything that used to be
listed here (item and dashboard shed scoping, the fail-open queue guard, the
`ITEM_HAS_HISTORY` rename block, archived items being invisible, `includeInactive`
coercion, `qty: 0` adjustment, socket re-auth after expiry) has been fixed and is
described above as current behaviour. Severity and verification status live in
`docs/project-status.md` (authoritative).

| # | Area | Today | What is needed |
|---|---|---|---|
| 1 | Packaging and deployment | No Docker build, no `docker compose up`, no deployment. Nothing has been installed on a tablet, and the PWA update flow and offline behaviour have not been exercised on a device. | Build and run the containers, install on the demo tablets, test update and offline reads. |
| 2 | Demo run | No 3–5 vehicle demo run has been performed, so the success criteria in `docs/00-product-scope.md` are unproven end to end. | Execute `docs/demo-script.md` on a fresh database. |
| 3 | CI and tests | No CI pipeline. There is no socket cross-shed integration test. Containers run as root. | Pipeline running typecheck/lint/build/tests; socket test; non-root container user. |
| 4 | Dashboard stock view | `GET /api/dashboard` returns only low-stock items, not a per-shed current-stock list. | Add a per-shed stock payload, or accept `GET /api/items` as the stock screen. |
| 5 | Small races | `createVisit` reads item rows (existence, `isActive`, short-stock warnings) before its transaction opens, so an item archived in between is still accepted. `deleteItem` checks usage in a separate transaction before archiving/deleting, so a line can be created in that window. | Move both reads inside the transaction, or lock the item rows first. |
| 6 | Adjust floor | `POST /api/items/:id/adjust` refuses any adjustment that would leave stock below zero, so a negative balance created by a confirm cannot be corrected with a negative adjustment. | Documented behaviour: stock in first, or allow a negative-going correction as a deliberate decision. |
| 7 | Dependency advisories | 5 `npm audit` advisories, from Prisma's `deepmerge-ts` and ExcelJS's `uuid`. No non-breaking fix is available. | Track upstream releases; upgrade when a compatible fix ships. |
| 8 | No last-admin protection | Self-disable is blocked (`CANNOT_DISABLE_SELF`), but two admins can disable each other and leave no `ADMIN` login. | Refuse the update that would remove the last active `ADMIN`. |
