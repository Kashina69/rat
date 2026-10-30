# 05 — Demo data and seed

What the seed puts in the database, what a reset destroys, what the reset guard does, and what the
3–5 vehicle demo is expected to show — under the **warn-only short-stock rule**. Operator steps are
in [demo-script.md](./demo-script.md); decisions are in [`decisions_made.md`](./decisions_made.md).

## 1. What the seed creates

`server/prisma/seed.ts` creates **2 sheds, 10 items, 4 users and 10 OPENING ledger rows**. It creates
**no visits and no requirement lines**, so Gate/Logs/Admin start empty and every row in the demo is
yours.

### Sheds

| Code | Name |
| --- | --- |
| `SHED-A` | Shed A |
| `SHED-B` | Shed B |

### Items (5 per shed)

| Item | Category | Unit | Shed | Opening stock | Reorder level |
| --- | --- | --- | --- | --- | --- |
| Item A1 | Ammo | box | SHED-A | 100 | 20 |
| Item A2 | Ammo | box | SHED-A | 150 | 30 |
| Item A3 | Fuse | pcs | SHED-A | 200 | 40 |
| Item A4 | Fuse | pcs | SHED-A | 80 | 10 |
| Item A5 | Shell | box | SHED-A | 60 | 15 |
| Item B1 | Ammo | box | SHED-B | 120 | 25 |
| Item B2 | Fuse | pcs | SHED-B | 90 | 20 |
| Item B3 | Shell | box | SHED-B | 70 | 10 |
| Item B4 | Charge | kg | SHED-B | 50 | 10 |
| Item B5 | Charge | kg | SHED-B | 40 | 5 |

Each new item is created with its `OPENING` ledger row (`delta = balanceAfter = opening stock`,
actor `admin`, reason `Opening stock`) **in the same transaction**, so an item never exists without
history. That history no longer blocks edits: name, category and reorder level are editable at any
time (unit and shed are fixed at creation). Deleting an item that has history archives it instead.

Invariant to check after any demo: `SUM(StockLedger.delta) == Item.currentStock` for every item.

### Users

| Username | Name | Role | Shed | Password source |
| --- | --- | --- | --- | --- |
| `admin` | Admin | ADMIN | — | `SEED_ADMIN_PASSWORD`, else dev fallback `Admin@123-dev-only` |
| `gate` | Gate Clerk | GATE | — | `SEED_GATE_PASSWORD`, else `Gate@123-dev-only` |
| `sheda` | Shed A Keeper | SHED | SHED-A | `SEED_SHEDA_PASSWORD`, else `ShedA@123-dev-only` |
| `shedb` | Shed B Keeper | SHED | SHED-B | `SEED_SHEDB_PASSWORD`, else `ShedB@123-dev-only` |

Usernames are lowercase. All passwords are bcrypt-hashed with 12 rounds; the fallbacks are
development-only (see [04-setup-and-env.md](./04-setup-and-env.md#8-dev-seed-passwords)). A plain
reseed re-applies these passwords, roles and sheds, so changing a `SEED_*_PASSWORD` value and
re-running `npm run db:seed` is enough — no `--reset` needed.

### User management (built)

The demo runs on the four seeded logins, but admin can also manage accounts live:
Admin → **Users** → create (name, username, password, role, shed), edit (name, role, shed),
**Disable/Enable**, **Reset password**. API: `GET/POST /api/users`, `PATCH /api/users/:id`,
`POST /api/users/:id/reset-password` — `ADMIN` only.

Behaviour worth knowing on stage:

- A disabled user's login returns the generic `401 Invalid credentials`; a token issued before the
  account was disabled returns `403 ACCOUNT_DISABLED` on the next request.
- Admin cannot disable itself (`409 CANNOT_DISABLE_SELF`), but there is **no last-admin
  protection** — do not disable the only admin on the demo database.
- Created users are not seed-owned: a `--reset` deletes them, a plain reseed leaves them alone.

### Role logins and tablet assignment

| Tablet | Login | Sees |
| --- | --- | --- |
| Gate tablet | `gate` | Register vehicles, inside list with per-shed line badges, checkout |
| Shed A tablet | `sheda` | Incoming queue for SHED-A only, SHED-A stock |
| Shed B tablet | `shedb` | Incoming queue for SHED-B only, SHED-B stock |
| Admin (laptop or 4th tablet) | `admin` | Dashboard, inventory, stock-in/adjust/archive, logs + CSV/Excel export, users |

`admin` can open any tab; the header tabs are UX only and the API still enforces roles and shed
scoping (`GET /api/items` and `GET /api/dashboard` are shed-scoped, `403 CROSS_SHED` on a foreign
shed).

Dashboard scope: vehicles inside, pending lines per shed and low stock (`currentStock <=
reorderLevel`). A full per-shed current-stock list is **not** built — use Admin → Inventory or the
logs export when you need every balance.

## 2. Running the seed

```bash
cd server
npm run db:seed                # upsert / add missing rows, refresh seed passwords, roles, sheds
npm run db:seed -- --reset     # delete all rows, then reseed
```

Seed output ends with `Seed complete: 2 sheds, 10 items, 4 users`. Passwords are never printed.

## 3. Reset behaviour

`--reset` runs one transaction that deletes, in FK order: `stockLedger` → `requirementLine` →
`auditEvent` → `visit` → `item` → `user` → `shed`. Then the seed re-creates everything. On the demo
database that means: all vehicles, ledger history, audit trail and any users created through the API
are gone; stock is back to the numbers in §1.

What reset does **not** do:

- It does not drop the schema or run migrations. Use `npx prisma migrate reset` (or the manual
  drop/create) if the schema itself is behind.
- It only resets the seed-owned tables; there is no other application data in the POC.

Behaviour without `--reset` (idempotent path):

- Sheds are `upsert`ed by `code` with `update: {}` — an existing shed keeps its name.
- Users are `upsert`ed by `username` and the `update` branch re-applies `name`, `passwordHash`,
  `role` and `shedId`. **Seed passwords rotate on a plain reseed.** `isActive` is not touched, so a
  seeded account you disabled stays disabled.
- Items are matched by `(shedId, name)` and skipped when present. Existing stock is never
  re-baselined, so a stale demo database keeps its old quantities — reseed with `--reset` before a
  demo.
- Re-running never duplicates OPENING ledger rows, because items that already exist are skipped.

### Production guard (implemented)

`npm run db:seed -- --reset` with `NODE_ENV=production` aborts:

```
Refusing to run --reset with NODE_ENV=production. Set ALLOW_DESTRUCTIVE_SEED=1 to override.
```

The override is an **environment variable**, not a CLI flag (`ALLOW_DESTRUCTIVE_SEED=1`), so it
cannot ride along in a copied command. Nothing is deleted before the guard runs — the check is the
first thing `main()` does.

Separately, a production seed never falls back to a dev password: it exits non-zero unless all four
`SEED_*_PASSWORD` values are set.

## 4. Visit and line statuses

Visit: `AWAITING_LOADING` → `PARTIALLY_LOADED` → `READY_FOR_CHECKOUT` → `CHECKED_OUT`, or
`CANCELLED` before checkout.

Line: `PENDING` → `LOADED`, or `CANCELLED`.

Recalculation after every confirm/cancel (one transaction with the line write):

- No `PENDING` left and at least one `LOADED` → `READY_FOR_CHECKOUT`.
- At least one `LOADED` and at least one `PENDING` → `PARTIALLY_LOADED`.
- All lines `CANCELLED` → `CANCELLED`.
- Otherwise `AWAITING_LOADING`.

Display per line is derived, never stored: load shortfall `requestedQty - loadedQty`; `FULL` when 0,
`SHORT` when **> 0**.

Checkout stays strict: allowed only from `READY_FOR_CHECKOUT`, otherwise `409 NOT_READY`. A
duplicate checkout is one winner plus one 409.

## 5. Stock rule — warn only

Authoritative rule (user decision, 2026-10-30):

- **Registration** never blocks on stock. If `requested > currentStock`, `POST /api/visits` returns
  the visit **plus** `warnings: [{ itemId, requested, available }]`; the vehicle is saved. The Gate
  screen shows the warning toast and keeps the row.
- **Confirm** validates only `1 <= loadedQty <= requestedQty` (else 400). There is no on-hand stock
  check, so the recorded stock may go **negative**.
- Every confirm still writes exactly one `OUT` ledger row with `delta = -loadedQty` and the balance
  computed under lock (`balanceAfter` can be negative). The invariant `SUM(delta) == currentStock`
  still holds.
- Double-confirm of the same line → `409 ALREADY_CONFIRMED`, no state change, no second deduction.
- Cross-shed confirm → `403 CROSS_SHED`.
- Checkout, cancellation rules and the ledger append-only rule are unchanged.

Recovering from a negative balance: use a **stock-in** or a **positive manual adjust** with a reason.
A manual adjust is signed but refuses any adjustment that would leave the item below zero
(`409 NEGATIVE_STOCK`), so there is no way to "adjust to zero" from a negative balance by going
further down — always add.

Consequence for the demo: no `409 INSUFFICIENT_STOCK` is expected anywhere. The expected behaviour
is: confirm succeeds, stock goes negative, admin restores it with a stock-in.

Known race windows (open, not fixed): `createVisit` reads the item rows outside the visit
transaction (so an item archived in that instant can still be put on a visit), and `deleteItem`
checks for usage before deciding archive-vs-delete (so a line created in between can strip an item
that then has history). Both are narrow, single-request windows; neither affects the demo script.

## 6. The 3–5 vehicle demo

Five vehicles cover one single-shed run, one **multi-shed** run, one short load, one over-stock run
and one cancellation. All use seeded items, so no preparation is required beyond a fresh seed. Steps
are in [demo-script.md](./demo-script.md).

| # | Vehicle | Lines | Expected path | Ends as |
| --- | --- | --- | --- | --- |
| 1 | `DEMO-01` | Item A1 × 10 (SHED-A) | Gate registers → `AWAITING_LOADING`; `sheda` confirms 10 → `READY_FOR_CHECKOUT`; `gate` checks out | `CHECKED_OUT` |
| 2 | `DEMO-02` | Item A2 × 5 (SHED-A) + Item B1 × 5 (SHED-B) | `sheda` confirms A-line → `PARTIALLY_LOADED` (checkout refused, `409 NOT_READY`); `shedb` confirms B-line → `READY_FOR_CHECKOUT`; `gate` checks out | `CHECKED_OUT` |
| 3 | `DEMO-03` | Item A3 × 20 (SHED-A) | `sheda` confirms 12 → line `LOADED`, display `SHORT`, shortfall 8; visit `READY_FOR_CHECKOUT`; checkout | `CHECKED_OUT` |
| 4 | `DEMO-04` | Item A5 × 80 (SHED-A, recorded 60) | Gate saves with a low-stock warning (no error); `sheda` confirms 80 → stock **-20**; checkout | `CHECKED_OUT` |
| 5 | `DEMO-05` | Item B2 × 5 (SHED-B) | `gate` cancels the line before loading → line `CANCELLED`, visit `CANCELLED`; no ledger row | `CANCELLED` |

Stock after the run (starting from §1):

| Item | Start | Movement | End |
| --- | --- | --- | --- |
| Item A1 | 100 | -10 (DEMO-01) | 90 |
| Item A2 | 150 | -5 (DEMO-02) | 145 |
| Item A3 | 200 | -12 (DEMO-03) | 188 |
| Item A5 | 60 | -80 (DEMO-04) | **-20**, then +50 stock-in → 30 |
| Item B1 | 120 | -5 (DEMO-02) | 115 |
| Item B2 | 90 | none (line cancelled) | 90 |

DEMO-02 (multi-shed) and DEMO-04 (over-stock) are the two that must not be dropped. DEMO-05 is
optional if time is short — four vehicles still satisfies the 3–5 requirement as long as one of them
is multi-shed.

Checks worth showing on screen:

- Gate → inside list badges: `PENDING` while waiting, `FULL`/`SHORT` after confirm, per shed.
- Shed queue only shows its own shed's pending lines; `sheda` never sees the B-line of DEMO-02.
- Admin dashboard: inside count and per-shed pending drop as vehicles are confirmed and checked out.
- Admin → inventory: `Item A5` reads `-20` after DEMO-04, and its ledger has `OPENING +60` and
  `OUT -80`.
- Logs: one row per requirement line, including `PENDING`/`CANCELLED`, with shortfall and timestamps
  in IST. A filter of `from = to = today` includes today's rows (the IST day-window fix).

**Demo status:** the script is written and the code it exercises is in place, but no 3–5 vehicle run
has been performed on the installed tablets (or anywhere else) as of 2026-10-30. Do not report the
demo as evidenced until it has been run and recorded.

## 7. Offline and cold launch

These are documented behaviour, not bugs:

- **Token in memory only.** Reloading the tab, closing the browser, or cold-launching the installed
  PWA logs the user out; log in again. There is no refresh token and nothing is persisted to
  `localStorage`.
- **No persisted query cache.** A cold launch while offline shows empty/error states, not the
  previous session's lists. Logout also clears the TanStack cache, so a shared tablet does not show
  the previous user's data.
- **Offline banner.** When the network drops, the shell shows `Disconnected — showing last synced
  data. Actions are disabled.` and the connection badge turns red with the last sync time. A
  degraded connection shows an amber variant.
- **Mutations are blocked offline.** Register, confirm, checkout, cancel, stock-in, adjust and
  create/edit are disabled; the API is never queued for later. TanStack Query refetches on
  focus/reconnect, and the socket reconnects.
- **Session expiry is explicit.** When the socket token expires the server emits `session.expired`;
  the client logs out, clears the query cache, shows a toast and stops reconnecting. There is no
  stale-reconnect loop, but there is also no silent renewal — the user signs in again.
- **PWA install** needs HTTPS or `localhost`. Install on each tablet from the browser's "Add to Home
  Screen"; the app opens standalone with the splash and icons from the manifest. Not yet verified on
  a device.

## 8. CSV and XLSX export

Both formats exist, use the same filters as the screen (vehicle, item, shed, line status, from, to)
and return all matching rows, unpaginated.

### CSV — Admin → Logs → **Export CSV**

- `GET /api/logs/export`, `text/csv; charset=utf-8`, file name `logs.csv`.
- Columns: Vehicle, Driver, Party, Arrival (IST), Checkout (IST), Visit Status, Shed, Item, Category,
  Unit, Requested, Loaded, Shortfall, Line Status, Display, Gate User, Confirmed By, Confirmed At
  (IST).
- Formatting guarantees: UTF-8 BOM so Excel renders correctly, CRLF line endings, every cell quoted,
  embedded quotes doubled, and cells whose first non-space character is `=`, `+`, `-` or `@`
  prefixed with `'` to neutralise formula injection (leading tabs/spaces/control characters do not
  bypass that). Seven unit tests pin the escaping.

### Excel — Admin → Logs → **Export Excel**

- `GET /api/logs/export.xlsx`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  file name `logs.xlsx`. `ADMIN` only, like CSV.
- Same columns and the same row order as the CSV (newest arrival first, then line id), built with
  ExcelJS: header row bold, frozen top row, per-column widths.
- Empty cells are written as blank; formula-like text stays literal text (a vehicle entered as
  `=1+1` is the string `=1+1`, never a formula).
- Four tests cover the workbook shape, CSV parity, filter parity and ADMIN-only access.

Check: export once with a vehicle filter and once with a line-status filter, in both formats; row
count and contents must match the on-screen table. Timestamps are IST even though storage is UTC.

`npm audit --omit=dev` flags the ExcelJS transitive `uuid` advisory (plus three Prisma
`deepmerge-ts` advisories); there is no non-breaking upgrade yet. See
[`06-deploy.md`](./06-deploy.md#11-remaining-gaps).

## 9. Tablet checklist

Run this on the three demo tablets (portrait and landscape, at least once before the demo, not
during it). **Not yet done:** no tablet install or device check has been performed.

- [ ] Installed from the browser to the home screen; app opens standalone without a URL bar
- [ ] Splash screen and icons correct after the latest shell change (192/512/maskable + apple-touch-icon)
- [ ] Gate form: text keyboards for vehicle/driver/party, numeric for quantity, item picker usable with one hand
- [ ] Shed confirm dialog: numeric keyboard, values above requested rejected client-side
- [ ] All touch targets ≥ 44 px; no control clipped in landscape
- [ ] Offline banner readable; badges and stale times visible without scrolling
- [ ] Airplane mode: mutations disabled with a clear message; reconnect refetches without a reload
- [ ] Logout → login round trip works on each role; cold launch returns to `/login`
- [ ] Live update seen on the other two tablets within a second of a confirm/checkout
- [ ] CSV and Excel exports download and open in the tablet's spreadsheet app with correct IST timestamps
- [ ] Portrait → landscape → portrait does not lose a half-filled form or dialog state
