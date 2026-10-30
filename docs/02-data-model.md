> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

# 02 — Data Model

Source of truth: `server/prisma/schema.prisma` plus one migration. MySQL 8.4 via
Prisma 6; `utf8mb4` / `utf8mb4_unicode_ci`; every PK an auto-increment `INT`; no
`deletedAt` columns (User and Item carry `isActive`). The only migration,
**`20261029110447_init`**, holds all seven tables, enums, indexes and FKs,
`users.isActive BOOLEAN NOT NULL DEFAULT true` and
`stock_ledger.reason VARCHAR(255)`; `prisma migrate status` is clean and schema
changes must be new migrations, never edits to `init`.

## Enums

Four authoritative vocabularies. Old concept names (Registered, Partly loaded,
Loaded) are superseded and wrong anywhere they appear.

| Enum | Values | Column |
| --- | --- | --- |
| `Role` | `ADMIN`, `GATE`, `SHED` | `users.role` |
| `VisitStatus` | `AWAITING_LOADING`, `PARTIALLY_LOADED`, `READY_FOR_CHECKOUT`, `CHECKED_OUT`, `CANCELLED` | `visits.status` |
| `RequirementLineStatus` | `PENDING`, `LOADED`, `CANCELLED` | `requirement_lines.status` |
| `LedgerType` | `OPENING`, `IN`, `OUT`, `ADJUST` | `stock_ledger.type` |

```text
Visit:  AWAITING_LOADING -> PARTIALLY_LOADED -> READY_FOR_CHECKOUT -> CHECKED_OUT
        any state before CHECKED_OUT -> CANCELLED (cancel rules apply)
Line:   PENDING -> LOADED | CANCELLED          (both terminal)
```

Visit status is never set by hand on confirm/cancel: `recalcVisitStatus`
(`server/src/utils/visitStatus.ts`) recomputes it — all lines `CANCELLED` (at
least one) → `CANCELLED`; no `PENDING` and ≥1 `LOADED` → `READY_FOR_CHECKOUT`;
≥1 `LOADED` with ≥1 `PENDING` → `PARTIALLY_LOADED`; else `AWAITING_LOADING`.
`CHECKED_OUT` is the only status written directly, by checkout, only from
`READY_FOR_CHECKOUT` (conditional `updateMany`).

## Entities

`?` marks nullable; every relation is a real FK.

| Entity | Fields |
| --- | --- |
| `Shed` (`sheds`) | `id` PK · `name` varchar(191) display · `code` varchar(191) unique — stable id in API paths, socket rooms (`SHED-A`) and exports. No timestamps |
| `User` (`users`) | `id` PK · `name` varchar(191) · `username` varchar(191) unique (lowercase in seed) · `passwordHash` varchar(191), bcrypt 12 rounds, never returned · `role` enum · `shedId?` FK → `sheds` `ON DELETE SET NULL`, set only for `SHED` · `isActive` boolean default `true`. No `createdAt`/`updatedAt` |
| `Item` (`items`) | `id` PK · `name` varchar(191) · `category` varchar(191) · `unit` varchar(191) (`box`/`pcs`/`kg` in seed) · `shedId` FK → `sheds` `RESTRICT` · `currentStock` int default `0`, denormalised roll-up · `reorderLevel` int default `0`, drives low stock · `isActive` boolean default `true`, `false` = archived |
| `Visit` (`visits`) | `id` PK · `vehicleNumber` varchar(191), max 20 · `driverName` varchar(191), max 120 · `party` varchar(191), max 120 · `status` enum default `AWAITING_LOADING` · `arrivalAt` datetime(3) default `now()`, also the log date field · `checkoutAt?` · `cancelledAt?` (set when the visit becomes `CANCELLED`, cleared otherwise) · `gateUserId` FK → `users` `RESTRICT` · `checkoutByUserId?` FK → `users` `SET NULL` |
| `RequirementLine` (`requirement_lines`) | `id` PK · `visitId` FK `RESTRICT` · `itemId` FK `RESTRICT` · `shedId` FK `RESTRICT`, **frozen copy** of the item's shed · `requestedQty` int 1..1,000,000 · `loadedQty?` int, set on confirm, `1..requestedQty` · `status` enum default `PENDING` · `confirmedByUserId?` FK `SET NULL` · `confirmedAt?` datetime(3) |
| `StockLedger` (`stock_ledger`) | `id` PK · `itemId` FK `RESTRICT` · `requirementLineId?` FK `SET NULL`, **unique** · `visitId?` FK `SET NULL` · `actorUserId` FK `RESTRICT` · `type` enum · `delta` int signed · `balanceAfter` int, stock right after this row (audit snapshot) · `reason?` varchar(255), free text, required for `ADJUST` · `createdAt` datetime(3) default `now()`. No `updatedAt` by design |
| `AuditEvent` (`audit_events`) | `id` PK · `userId` FK `RESTRICT` · `action` varchar(191) · `entity` varchar(191) (`Item`, `Visit`, `RequirementLine`, `User`) · `entityId` varchar(191), stored as string · `createdAt` datetime(3) default `now()` |

Secondary keys: unique `(visitId, itemId)` on lines (one line per item per visit —
a vehicle cannot request the same item twice); index `(visitId, shedId, status)`
for the shed queue and status recompute; unique `requirementLineId` on the ledger
(DB-level guard against a double confirm); index `(itemId, createdAt)` on the
ledger; index `status` on visits; index `shedId` on items.

Not enforced in the DB: unique `(shedId, name)` on items (duplicates possible), "a
`SHED` user must have a shed" (service `SHED_REQUIRED` / `SHED_NOT_ALLOWED`),
last-admin protection. Audit actions written today: `ITEM_CREATED`,
`ITEM_UPDATED`, `ITEM_ARCHIVED`, `ITEM_DELETED`, `STOCK_IN`, `STOCK_ADJUSTED`,
`VISIT_CREATED`, `VISIT_CANCELLED`, `LINE_CANCELLED`, `LINE_CONFIRMED`,
`VISIT_CHECKOUT`, `USER_CREATED`, `USER_UPDATED`, `USER_DISABLED`,
`USER_ENABLED`, `USER_PASSWORD_RESET`.

## Relations

```text
Shed 1─* User, Item, RequirementLine
User 1─* Visit (gateUser, checkoutByUser), RequirementLine (confirmedBy), StockLedger (actor), AuditEvent
Visit 1─* RequirementLine, StockLedger        Item 1─* RequirementLine, StockLedger
RequirementLine 1─0..1 StockLedger            (the single OUT row)
```

`RESTRICT` on item, visit, line and actor references is why an item with history
cannot be hard-deleted and a user who handled stock or a visit cannot be deleted
at all — hence item archive and `isActive = false`; `SET NULL` applies only to
optional back-references, and there is no user delete endpoint.

## Ledger invariant and append-only rule

```text
items.currentStock == SUM(stock_ledger.delta) WHERE stock_ledger.itemId = items.id
```

Must hold for every item at all times. `balanceAfter` is a denormalised audit
snapshot, not the source of truth; if it disagrees with the running sum, the sum
of `delta` wins.

Write path — one transaction, item row locked (`lockItemForUpdate`,
`server/src/utils/rowLocks.ts`): `SELECT … FOR UPDATE` → `balanceAfter =
currentStock + delta` → update `items.currentStock` → insert exactly one
`stock_ledger` row with the same `delta` and `balanceAfter` → audit → commit.

| Action | `type` | `delta` | Extra columns |
| --- | --- | --- | --- |
| Item created with opening stock, and seed | `OPENING` | `+opening` (0 allowed) | `reason = 'Opening stock'`; every item gets one, even at 0 |
| `POST /api/items/:id/stock-in` | `IN` | `+qty` | `reason` from body or `'Stock in'` |
| `POST /api/items/:id/adjust` | `ADJUST` | signed `qty`, never 0 | `reason` required, ≤255; result may not go below 0 (`409 NEGATIVE_STOCK`) |
| `POST /api/requirement-lines/:id/confirm` | `OUT` | `-loadedQty` | `requirementLineId`, `visitId`; `reason` null |

`OUT` is the only write that may take `currentStock` below zero (confirm is
warn-only); zero delta and any negative-going `ADJUST` are refused, so a negative
balance can only be corrected by a stock-in first.

Append-only: rows are inserted once, never updated or deleted by application code
(no UPDATE/DELETE path in `items.service.ts` or `visits.service.ts`); corrections
are compensating `ADJUST` rows. No DB trigger enforces this — it is a code
convention reinforced by the unique `requirementLineId`.

## Frozen `shedId` on requirement lines

`RequirementLine.shedId` is copied from `Item.shedId` at visit creation and never
updated afterwards — line updates touch only `status`, `loadedQty`,
`confirmedByUserId`, `confirmedAt`. Routing is therefore decided at registration
(moving an item to another shed does not re-route or re-alert existing lines), and
the shed queue plus `CROSS_SHED` checks read the frozen column, not the item's
current shed; the user side is read live from `users.shedId`.

## Archive rules

Archive applies to `Item` only. `User` uses `isActive` for account disabling;
`Shed`, `Visit`, `RequirementLine` and `StockLedger` have no flag.

| Situation | Behaviour |
| --- | --- |
| `DELETE /api/items/:id` with any requirement line or ledger row | `isActive = false`, audit `ITEM_ARCHIVED`, respond `{ archived: true, item }` |
| `DELETE /api/items/:id` with no lines and no ledger rows | hard delete, audit `ITEM_DELETED`, respond `{ archived: false, item }` (snapshot before deletion) |
| `PUT /api/items/:id` with `isActive: false` / `true` | archive / restore; other fields in the same request still apply |
| Archived item in a new visit or stock movement | rejected `409 ITEM_INACTIVE` |
| Archived item on an existing `PENDING` line | still confirmable — confirm does not check `isActive`, so a live visit is never stranded |

`GET /api/items` returns active rows only unless `includeInactive=true` (exactly
`true`/`false`/`1`/`0`; anything else is `400 VALIDATION_ERROR`). The admin screen
sends `includeInactive=true` and offers restore. Archived items stay attached to
history — out of active lists, never out of logs.

## Derived values

| Field | Rule | Stored |
| --- | --- | --- |
| `display` | `PENDING` → `"PENDING"`; `CANCELLED` → `"CANCELLED"`; `LOADED` → `"FULL"` if `loadedQty >= requestedQty`, else `"SHORT"` | no |
| `shortfall` | `requestedQty - loadedQty` when `LOADED`, else `null` | no |

Computed per line in `server/src/modules/visits/visits.dto.ts`, returned in every
line, queue, log and export payload, so they always match. A `SHORT` line is a
normal `LOADED` line — no separate status. `Visit.status` and `Item.currentStock`
are the only cached derived values that are stored, kept in sync in the same
transaction. Absent by design: no `createdAt`/`updatedAt`/`passwordChangedAt` on
users, no audit read path, no per-shed current-stock table (dashboard serves
`lowStock` only) — planned gaps: @docs/project-status.md.

Related: @docs/01-architecture.md, @docs/03-api-contract.md, @docs/decisions_made.md
