> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

# 05 — Demo data and seed

Seed contents, reset, the 3–5 vehicle demo with expected statuses and stock deltas, offline, export
checks, tablet checklist. Schema/statuses: @docs/02-data-model.md · commands, env, dev passwords:
@docs/04-setup-and-deploy.md · endpoints: @docs/03-api-contract.md.

## 1. What the seed creates

`server/prisma/seed.ts` creates **2 sheds, 10 items, 4 users and 10 `OPENING` ledger rows** (item and
opening row in one transaction), **no visits, no lines**, so Gate, Logs and Admin start empty. Items
with opening stock / reorder level:

- **SHED-A** (Shed A): A1 Ammo box 100 / 20 · A2 Ammo box 150 / 30 · A3 Fuse pcs 200 / 40 ·
  A4 Fuse pcs 80 / 10 · A5 Shell box 60 / 15
- **SHED-B** (Shed B): B1 Ammo box 120 / 25 · B2 Fuse pcs 90 / 20 · B3 Shell box 70 / 10 ·
  B4 Charge kg 50 / 10 · B5 Charge kg 40 / 5

| Username | Role | Shed |
| --- | --- | --- |
| `admin` | ADMIN | — |
| `gate` | GATE | — |
| `sheda` | SHED | SHED-A |
| `shedb` | SHED | SHED-B |

Usernames are lowercase. Dev passwords and `SEED_*_PASSWORD` overrides:
`@docs/04-setup-and-deploy.md` §8. A production seed exits non-zero unless all four are set;
passwords are never printed.

Admin → **Users** also creates, edits, disables/enables and resets passwords live: a disabled login
gets the generic `401`, an issued token `403 ACCOUNT_DISABLED`. There is **no last-admin
protection**; API-created users are dropped by `--reset`, kept by a plain reseed.

## 2. Reset behaviour

- `npm run db:seed` is idempotent: sheds/users/items are kept, seed passwords, roles and sheds are
  re-applied, `isActive` is untouched, stock is never re-baselined, `OPENING` rows never duplicated,
  and the schema is not touched — use `npx prisma migrate reset` if the schema is behind.
- `npm run db:seed -- --reset` deletes in FK order in one transaction — `stockLedger` →
  `requirementLine` → `auditEvent` → `visit` → `item` → `user` → `shed` — then reseeds: all vehicles,
  ledger history, audit rows and API-created users are gone, stock is back to §1.
- Guard: with `NODE_ENV=production`, `--reset` aborts with `Refusing to run --reset with
  NODE_ENV=production. Set ALLOW_DESTRUCTIVE_SEED=1 to override.` The override is an **environment
  variable**, not a CLI flag, and the check runs before any delete. Never use it on live data.

## 3. The five-vehicle demo

Start from `npm run db:seed -- --reset`, then log three tablets in as `gate`, `sheda` (SHED-A) and
`shedb` (SHED-B), with `admin` on a laptop; every badge must read **Live**.

Stock rule throughout: **warn only** — registration saves with a warning, confirm has no on-hand
check, recorded stock may go **negative**, and no `409 INSUFFICIENT_STOCK` appears anywhere.

**DEMO-01 — single shed (Item A1 × 10, SHED-A)**

1. Gate: register `DEMO-01`, driver + party, line **Item A1 × 10**.
2. Shed A: confirm **10** → `LOADED` / `FULL`, visit `READY_FOR_CHECKOUT`; Gate checks out. A1 100 → 90.

**DEMO-02 — multi-shed (required) (Item A2 × 5 SHED-A + Item B1 × 5 SHED-B)**

1. Gate: register `DEMO-02` with both lines.
2. Shed A: confirm A2 with **5** → `PARTIALLY_LOADED`; checkout refused (`409 NOT_READY`).
3. Shed B: confirm B1 with **5** → `READY_FOR_CHECKOUT`, both badges `FULL`; Gate checks out →
   A2 150 → 145, B1 120 → 115.

**DEMO-03 — short load (Item A3 × 20, SHED-A)**

1. Gate: register `DEMO-03`, line **Item A3 × 20**.
2. Shed A: confirm only **12** → `LOADED` / `SHORT`, shortfall 8, `READY_FOR_CHECKOUT`; Gate checks
   out. A3 200 → 188 — a short load is a finished line, not a blocker.

**DEMO-04 — over-stock, warn only (Item A5 × 80 recorded 60)**

1. Gate: register `DEMO-04`, line **Item A5 × 80** → low-stock warning toast, no error, no 409.
2. Shed A: confirm **80** → allowed; A5 60 → **-20**, ledger `OUT -80`, balance `-20`; Gate checks out.
3. Admin → Inventory: A5 reads `-20`; **stock-in 50** → 30. A positive adjust also works; one ending
   below zero is refused (`409 NEGATIVE_STOCK`), so recover by adding.

**DEMO-05 — cancellation (optional) (Item B2 × 5, SHED-B)**

1. Gate: register `DEMO-05`, line **Item B2 × 5**, cancel before loading → both `CANCELLED`, no ledger
   row, B2 stays 90.

Any three complete vehicles pass if one is multi-shed. DEMO-02 and DEMO-04 must not be dropped.

## 4. Expected results and stock deltas

| Vehicle | Final visit | Line status | Stock after |
| --- | --- | --- | --- |
| `DEMO-01` | `CHECKED_OUT` | A1 `LOADED` / FULL | A1 90 |
| `DEMO-02` | `CHECKED_OUT` | A2 `LOADED`, B1 `LOADED` | A2 145, B1 115 |
| `DEMO-03` | `CHECKED_OUT` | A3 `LOADED` / SHORT, shortfall 8 | A3 188 |
| `DEMO-04` | `CHECKED_OUT` | A5 `LOADED` / FULL, stock negative | A5 -20, then 30 after stock-in |
| `DEMO-05` | `CANCELLED` | B2 `CANCELLED` | B2 90, unchanged |

**On screen:** Gate badges `PENDING` while waiting, `FULL`/`SHORT` after confirm; `sheda` never sees
the B1 line of DEMO-02; dashboard inside count and per-shed pending drop as vehicles confirm and
leave; A5 shows `-20` with ledger `OPENING +60` and `OUT -80`; logs list every line, including
`PENDING`/`CANCELLED`, with shortfall and IST timestamps (`from = to = today` includes today).
**Say out loud:** `SUM(StockLedger.delta) == Item.currentStock` must hold even when stock is negative.

## 5. Offline and cold launch

Documented behaviour, not bugs:

- **Token in memory only, no persisted cache** — reload, close or cold PWA launch logs the user out
  and shows empty/error states, not last session's lists; logout also clears the TanStack cache.
- **Offline banner** `Disconnected — showing last synced data. Actions are disabled.` with a red
  badge and last sync time; a degraded connection turns it amber.
- **Mutations are blocked offline** — register, confirm, checkout, cancel, stock-in, adjust and
  create/edit are disabled, never queued; reconnect refetches and the socket reconnects.
- **Session expiry is explicit** — the server emits `session.expired`, the client logs out and clears
  the cache. No silent renewal.
- **PWA install** needs HTTPS or `localhost`; it then opens standalone with the manifest splash.

## 6. CSV and Excel export checks

Both formats use the log screen's filters (vehicle, item, shed, line status, from, to) and return
every matching row unpaginated: `GET /api/logs/export` → `logs.csv`, `GET /api/logs/export.xlsx` →
`logs.xlsx`, `ADMIN` only. CSV is UTF-8 with BOM, CRLF, all cells quoted, `=`/`+`/`-`/`@` prefixed
with `'`; Excel matches the CSV columns and row order with a bold frozen header.

- [ ] One export with a vehicle filter and one with a line-status filter, in **both** formats
- [ ] Rows match the filtered on-screen table, including `PENDING`/`CANCELLED` lines
- [ ] Timestamps are IST; CSV opens without mojibake; `=1+1` shows as `'=1+1` in CSV, text in Excel
- [ ] A non-admin login is refused (`403`)

## 7. Tablet checklist

Run on the three demo tablets, portrait and landscape, once before the demo — not during it.

- [ ] Installed to the home screen, opens standalone; splash and icons correct; targets ≥ 44 px
- [ ] Gate form: text keyboards for vehicle/driver/party, numeric for quantity, one-handed item picker
- [ ] Shed confirm dialog: numeric keyboard, values above requested rejected before submit
- [ ] Offline banner and stale times readable; airplane mode disables mutations with a clear message
- [ ] Reconnect refetches; live update lands on the other tablets within a second; nothing clipped
- [ ] Logout → login per role; cold launch returns to `/login`; both exports open with IST timestamps
- [ ] Portrait → landscape → portrait keeps a half-filled form or dialog state

**Status:** the script and the code exist, but no 3–5 vehicle run, tablet install or device check has
been performed as of 2026-10-30; do not report the demo as evidenced until the run is recorded.

Related: @docs/02-data-model.md, @docs/03-api-contract.md, @docs/04-setup-and-deploy.md, @docs/project-status.md
