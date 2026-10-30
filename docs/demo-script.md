# Demo script — fresh DB → full pass (Phase 06 acceptance)

Target: 3–5 vehicles, single + multi-shed, on a public link.

## 0. Reset

```bash
# local
mysql -uroot -e "DROP DATABASE dms; CREATE DATABASE dms;"
cd server && npx prisma migrate deploy && npm run db:seed -- --reset
```

Production: set `SEED_ADMIN_PASSWORD`, `SEED_GATE_PASSWORD`,
`SEED_SHEDA_PASSWORD`, `SEED_SHEDB_PASSWORD` (long random, via secrets
manager — never in the image). Seed refuses to run in production without them.

Then: `admin / gate / sheda (SHED-A) / shedb (SHED-B)` exist with env passwords.

## 1. Single-shed vehicle (Gate → Shed A → Gate)

1. Login as `gate`. Register vehicle `DEMO-01`, driver + party, line:
   Item A1 × 10.
2. Login as `sheda`. Shed tab shows `DEMO-01` in Incoming queue.
   Confirm line, loaded 10. Status → `READY_FOR_CHECKOUT`.
3. Login as `gate`. Inside list shows `DEMO-01` ready. Checkout.
   Status → `CHECKED_OUT`.

## 2. Multi-shed vehicle (Gate → Shed A + Shed B → Gate)

1. Login as `gate`. Register `DEMO-02` with two lines:
   Item A2 × 5 (Shed A), Item B1 × 5 (Shed B).
2. `sheda` confirms the A-line → status `PARTIALLY_LOADED`.
   `shedb` confirms the B-line (concurrently is fine) → `READY_FOR_CHECKOUT`.
3. `gate` checks out `DEMO-02`.

## 3. Booking edge (optional, proves ledger invariant)

1. Register `DEMO-03` requesting more than stock for one item —
   confirm returns `409 INSUFFICIENT_STOCK`, stock unchanged.
2. Admin → Inventory → `SUM` check: ledger `OUT` rows match deductions.

## Session behavior (cold PWA launch)

- Token lives in memory. Cold launch = logged out → relogin required.
  This is documented behavior, not a bug.
- Offline: mutations blocked with banner, lists show last-synced + Stale.
  Reconnect → refetch on window focus.

## SW update

- New deploy → amber "A new version is ready" prompt. Tap "Reload now"
  only between operations — never force-reloads mid-form.

## CSV export

- Admin → Logs → set filters → Export CSV. File matches on-screen filters,
  formula cells (`= + - @` prefix) escaped with leading `'`, BOM included.

## Tablet checklist (portrait + landscape)

- [ ] Touch targets ≥ 44px, keyboards (text/numeric) correct per field
- [ ] Splash + icons on home-screen install (re-verify after shell change)
- [ ] Offline banner readable, reconnect refetch observed
