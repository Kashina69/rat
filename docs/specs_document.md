# DMS POC — Specs Document

> **Historical — superseded by `docs/decisions_made.md` + `docs/project-status.md`. Do not implement from this file.**

## 1. What is this

Depot Management System (POC) for an ammunition depot. It replaces phone calls and paper slips between gate, sheds, and office with three browser tablets that sync live.

Proves one loop: vehicle arrives → gate registers requirement → correct shed(s) alerted instantly → shed confirms loading → stock auto-deducts + ledger written → gate checks out.

Source: `docs/DMS_POC_Concept_Document.docx`.

## 2. For what / who

- Gate (security / clerk): register arriving vehicle + requirement, checkout.
- Shed (storekeeper, one login per shed): see incoming queue, confirm loaded qty.
- Admin (officer): manage inventory, watch all vehicles live, review in/out logs, export CSV.

Runs as installable web app in browser. No app-store release for POC.

## 3. What it does

Must-haves (10):
1. Role login (admin, gate, shed). Shed user tied to one shed.
2. Register vehicle: number, driver, unit/party, arrival time.
3. Enter requirement: item + qty lines, warn if stock short.
4. Route each line to shed holding the item, alert that shed instantly.
5. Shed queue + confirm items with actual loaded qty.
6. Auto-deduct stock on confirm + write ledger row.
7. Checkout only after all sheds confirmed.
8. Inventory CRUD: name, category, unit, shed, opening stock.
9. Stock-in + manual adjust with reason.
10. In/out log: vehicle, time, what loaded, who handled it. Filter + search.

Should-haves (2):
11. Dashboard: vehicles inside, per-shed status, current stock.
12. Export log to CSV/Excel.

Multi-shed rule: one vehicle can need items from 2 sheds. Track each shed separately. Checkout blocked until all complete.

## 4. How it does it

### Flow — 6 steps

1. Truck arrives. Gate enters vehicle + lines. Example: 100x from Shed-A, 50x from Shed-B.
2. Backend saves visit as REGISTERED, routes lines by `Item.shedId`, pushes `requirement.created` to `shed:SHED-A` + `shed:SHED-B` rooms. Sheds see alert in ~1s, no refresh.
3. Shed opens queue, loads truck, confirms with actual qty.
4. Backend transaction on each confirm: decrement `Item.currentStock`, insert `StockLedger OUT`, mark line LOADED, recompute visit status, insert `AuditEvent`. Then emits `loading.confirmed` + `stock.updated`.
5. When all lines LOADED → visit LOADED. Gate checkout allowed. Otherwise 409 blocked.
6. Checkout sets CHECKED_OUT + checkoutAt. Admin sees all changes live in `admin` room.

Visit status: `REGISTERED → AWAITING_LOADING → PARTLY_LOADED → LOADED → CHECKED_OUT`.

### Architecture

```
[Gate] ─┐
[Shed] ─┼─ REST (writes/reads) + Socket.IO (pushes) ─ Express ─ Prisma ─ MySQL
[Admin] ┘
```

- REST for everything. Socket only for notifications + invalidation triggers.
- Write-then-push: DB transaction first, socket emit after commit.
- Rooms: `shed:{code}`, `gate`, `admin`.

### Core rules

- Routing: `RequirementLine.shedId = Item.shedId` at creation time.
- Short stock: warn, don't block. Response includes `warnings: [{itemId, requested, available}]`.
- Checkout: strict. All lines must be LOADED.
- Stock: never update without ledger row. Double-confirm safe: confirm fails if line already LOADED.
- Auth: bcrypt (12 rounds) + JWT access-only (~8h shift). Role + shedCode in payload. Client keeps token in memory (Context), not localStorage. `auth` middleware + `requireRole()` guard. Shed users can only touch own shed.
- Security: helmet, CORS whitelist, login rate-limit, zod validate all inputs, central error shape `{ error: { code, message } }`, audit every mutation.

## 5. Tech choices

- Backend: Express 5 + TypeScript strict. Simple, matches team, enough for POC.
- DB: MySQL + Prisma. Transactions keep stock + ledger consistent.
- Realtime: Socket.IO. Matches concept doc, per-room pushes, simple client lib.
- Frontend: Next.js 16 + Tailwind 4 + shadcn. One codebase, tablet-first layout.
- Data fetching: TanStack Query for all server state. React Context for auth + socket. No zustand in POC unless client state outgrows Context.
- Quality: Biome, `tsc --noEmit`.

## 6. Data entities

- User: name, username, passwordHash, role ADMIN|GATE|SHED, shedId?
- Shed: name, code unique.
- Item: name, category, unit, shedId, currentStock, reorderLevel.
- Visit: vehicleNumber, driverName, party, status, arrivalAt, checkoutAt?, gateUserId.
- RequirementLine: visitId, itemId, shedId, requestedQty, loadedQty?, PENDING|LOADED.
- StockLedger: itemId, type IN|OUT|ADJUST, qty, visitId?, userId, reason?, createdAt.
- AuditEvent: userId, action, entity, entityId, createdAt.

## 7. Success

3–5 vehicles (include 1 multi-shed) run full cycle with zero manual correction. Stock numbers match ledger. CSV export correct.
