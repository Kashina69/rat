# Phase 05 — Role screens

Goal: all three tabs working from installed tablets. Server state only via TanStack Query. Socket events → invalidate.

## 1. Files to add

```text
client/src/
  app/gate/page.tsx, app/shed/page.tsx, app/admin/page.tsx
  components/gate/VehicleForm.tsx, InsideList.tsx, CheckoutButton.tsx
  components/shed/IncomingQueue.tsx, ConfirmDialog.tsx, ShedStock.tsx
  components/admin/InventoryTable.tsx, ItemEditor.tsx, StockDialogs.tsx, LogsTable.tsx, DashboardCards.tsx
  hooks/useVisits.ts, useShedQueue.ts, useItems.ts, useDashboard.ts, useLogs.ts, useSocket.ts
```

## 2. Gate

- `VehicleForm.tsx`: vehicle number, driver, party, dynamic lines (item select + qty). Item list readable by gate. Show advisory short-stock warnings from response, still save. Toast result.
- `InsideList.tsx`: inside visits with per-shed line badges (PENDING / FULL / SHORT / CANCELLED).
- `CheckoutButton.tsx`: disabled with reason until READY_FOR_CHECKOUT. Calls checkout, toasts 409 detail. Never allow from PARTIALLY_LOADED.

## 3. Shed

- `IncomingQueue.tsx`: pending lines for own shed, grouped by vehicle, arrival time shown.
- `ConfirmDialog.tsx`: shows requested qty, input loadedQty (`1..requested`). Mutation disabled while pending (double-tap protection). Toast FULL vs SHORT result.
- `ShedStock.tsx`: own-shed items + stock. Stale label when disconnected.

## 4. Admin

- `InventoryTable.tsx` + `ItemEditor.tsx`: create/edit dialog (no stock field on edit), archive instead of delete.
- `StockDialogs.tsx`: stock-in (qty > 0) + adjust (qty signed + reason required).
- `LogsTable.tsx`: filters vehicle/item/shed/status/date, same definition as export. Export button → `/api/logs/export` CSV download.
- `DashboardCards.tsx`: inside count, per-shed pending, low stock.

## 5. Hooks + socket wiring

- `useVisits / useShedQueue / useItems / useDashboard / useLogs`: queries + mutations.
- `useSocket.ts`: subscribe → `queryClient.invalidateQueries` per Phase 03 table. On reconnect/resume/focus: refetch.

## Verify

- [ ] Scripted demo 3–5 vehicles incl. 1 multi-shed, all from installed tablets
- [ ] Gate→shed alert instant, confirm→gate/admin instant
- [ ] Partial load shows SHORT + shortfall, checkout allowed once resolved
- [ ] Double-tap confirm / duplicate checkout safe
- [ ] Offline: mutations blocked with clear message, stale labels shown
- [ ] Ledger + CSV match screen
