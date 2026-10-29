# Phase 02 — Core APIs (REST only, no socket yet)

Goal: full vehicle loop works over REST. Atomic stock, strict checkout, cancellation, logs + CSV.

## 1. Files to add

```text
server/src/
  validators/visit.schemas.ts, validators/item.schemas.ts, validators/shed.schemas.ts, validators/log.schemas.ts
  modules/visits/visits.routes.ts, visits.controller.ts, visits.service.ts
  modules/sheds/sheds.routes.ts, sheds.controller.ts, sheds.service.ts
  modules/items/items.routes.ts, items.controller.ts, items.service.ts
  modules/logs/logs.routes.ts, logs.controller.ts, logs.service.ts
  modules/dashboard/dashboard.routes.ts, dashboard.service.ts
```

## 2. Visits

- `POST /api/visits` (gate): body vehicleNumber, driverName, party, lines[{itemId, qty}]. Min 1 line. qty int > 0. Look up Item, freeze `shedId` onto line. Unique (visitId, itemId) enforced. Status = AWAITING_LOADING. Warnings advisory only: `[{itemId, requested, available}]` where requested > stock. Registration reserves nothing.
- `GET /api/visits?status=inside` (gate, admin): inside = not CHECKED_OUT/CANCELLED. Include lines + item + shed.
- Cancel: `POST /api/visits/:id/cancel` (gate). Allowed only if zero lines LOADED. Sets CANCELLED. No stock movement.
- Cancel line: `POST /api/requirement-lines/:id/cancel` (gate). Only if PENDING. Sets CANCELLED. Recalc visit status in same transaction.

## 3. Shed confirm (atomic — the critical part)

- `GET /api/sheds/:code/queue` (shed own code only, admin any): visits with PENDING lines for that shed.
- `POST /api/requirement-lines/:id/confirm { loadedQty }` (shed own shed only):
  - Rule: `1 <= loadedQty <= requestedQty`. Else 400.
  - One interactive Prisma transaction, row locks in order Visit → RequirementLine → Item (`SELECT ... FOR UPDATE` via $queryRaw, or conditional updateMany with affected-row check):
    1. Lock visit. Reject if CHECKED_OUT/CANCELLED.
    2. Lock line. Must be PENDING + belong to caller shed. Else 409 ALREADY_CONFIRMED / 403.
    3. Lock item. Require `currentStock >= loadedQty`. Else 409 INSUFFICIENT_STOCK, rollback.
    4. Same tx: decrement stock, line LOADED + loadedQty + confirmedBy + confirmedAt, one OUT ledger row (delta negative, balanceAfter computed under lock, requirementLineId set), recalc visit status, audit row.
  - Recalc rule: no PENDING + ≥1 LOADED → READY_FOR_CHECKOUT. ≥1 LOADED + ≥1 PENDING → PARTIALLY_LOADED. All CANCELLED → CANCELLED.
  - Display: LOADED + shortfall 0 = FULL, shortfall > 0 = SHORT (derive `requestedQty - loadedQty`, don't store).
  - Never edit a confirmed load. Corrections = new compensating ledger entry.
- Double-confirm same line → 409, zero state change.

## 4. Checkout (strict = no unresolved lines)

- `POST /api/visits/:id/checkout` (gate): transactional + conditional. Allowed only from READY_FOR_CHECKOUT. Sets CHECKED_OUT + checkoutAt + checkoutByUserId. Else 409. Duplicate checkout → one wins, other 409.

## 5. Items (admin)

- `GET /api/items?shed=` list.
- `POST /api/items`: create + OPENING ledger row in same tx.
- `PUT /api/items/:id`: never accepts currentStock. No unit/shed change after transactions exist.
- `DELETE /api/items/:id`: archive via isActive=false if any lines/ledger exist. Hard delete only if unused.
- `POST /api/items/:id/stock-in { qty }`: qty > 0, increment + IN ledger, same tx.
- `POST /api/items/:id/adjust { qty, reason }`: reason required. qty signed delta (can be negative), must not drive stock < 0. ADJUST ledger row.

## 6. Logs + dashboard + export

- `GET /api/logs?vehicle=&item=&shed=&status=&from=&to=&page=&limit=`: one row per requirement line (include PENDING/CANCELLED, not just ledger). Fields: vehicle, driver, party, arrival, checkout, visit status, shed, item, requested, loaded, shortfall, line status, gate user, confirmed-by + timestamp. from/to apply to arrivalAt. Pagination metadata separate from `{ data }`.
- `GET /api/dashboard`: inside count, per-shed pending lines, low stock (currentStock <= reorderLevel).
- `GET /api/logs/export`: same filters as /logs, CSV download. UTC store, display/export Asia/Kolkata. Quote cells, neutralize cells starting with `= + - @` (formula injection).

## Verify

- [ ] Multi-shed visit: confirm A → PARTIALLY_LOADED, checkout 409 → confirm B → READY_FOR_CHECKOUT → checkout 200
- [ ] Re-confirm same line → 409, stock unchanged
- [ ] Confirm more than stock → 409 INSUFFICIENT_STOCK, nothing changes
- [ ] Partial load 40/100 → LOADED/SHORT, shortfall 60, checkout allowed once all resolved
- [ ] Cancel pending visit → CANCELLED, no ledger rows
- [ ] `SUM(ledger.delta) == currentStock` for every item
- [ ] Cross-shed confirm → 403
