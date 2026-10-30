# Demo script — fresh DB → 5 vehicles (single + multi-shed)

Target: 3–5 vehicles, at least one multi-shed, run from the installed tablets. Background detail:
[05-demo-and-seed.md](./05-demo-and-seed.md).

Stock rule in force: **short stock warns only**. Registration saves with a warning, shed confirm has
no on-hand check, recorded stock may go negative. No `409 INSUFFICIENT_STOCK` is expected anywhere in
this script.

**Status:** this script has not been executed end to end, on tablets or otherwise (2026-10-30). The
workflow it describes exists in code; the run is the missing evidence.

## 0. Reset and logins

From the repo root:

```bash
docker compose ps              # mysql must be healthy before you start
cd server
npm run db:seed -- --reset     # wipes visits/ledger/users, reseeds 2 sheds, 10 items, 4 users
```

Reset guard: with `NODE_ENV=production`, `--reset` is refused unless `ALLOW_DESTRUCTIVE_SEED=1` is
exported. It is safe to run the command above locally; never run it against live data even with the
override.

Production, if you ever seed there: `SEED_ADMIN_PASSWORD`, `SEED_GATE_PASSWORD`,
`SEED_SHEDA_PASSWORD`, `SEED_SHEDB_PASSWORD` must be set (long random, from a secrets manager). A
production seed refuses to fall back to dev passwords.

Logins (lowercase): `gate`, `sheda` (SHED-A), `shedb` (SHED-B), `admin`.
Dev passwords: `Gate@123-dev-only`, `ShedA@123-dev-only`, `ShedB@123-dev-only`, `Admin@123-dev-only`.

Open three tablets on `gate`, `sheda`, `shedb`; keep `admin` on a laptop. Confirm the badges read
**Live**.

## 1. Single-shed vehicle — `DEMO-01`

1. Gate: register `DEMO-01`, driver + party, line **Item A1 × 10**.
   → visit `AWAITING_LOADING`, line `PENDING`.
2. Shed A: `DEMO-01` appears in the incoming queue. Confirm **10**.
   → line `LOADED` / `FULL`, visit `READY_FOR_CHECKOUT`. Gate screen updates on its own.
3. Gate: check out `DEMO-01`.
   → visit `CHECKED_OUT`. Stock: A1 100 → 90.

## 2. Multi-shed vehicle — `DEMO-02` (required)

1. Gate: register `DEMO-02` with two lines: **Item A2 × 5** and **Item B1 × 5**.
2. Shed A: confirm the A2 line with **5**.
   → visit `PARTIALLY_LOADED`. Gate: checkout must be refused (`409 NOT_READY`) — the B line is still
   pending.
3. Shed B: confirm the B1 line with **5**.
   → visit `READY_FOR_CHECKOUT`; gate sees both badges `FULL`.
4. Gate: check out `DEMO-02`.
   → `CHECKED_OUT`. Stock: A2 150 → 145, B1 120 → 115.

## 3. Short load — `DEMO-03`

1. Gate: register `DEMO-03`, line **Item A3 × 20**.
2. Shed A: confirm only **12**.
   → line `LOADED`, display `SHORT`, shortfall 8. Visit `READY_FOR_CHECKOUT` — a short load is a
   finished line, not a blocker.
3. Gate: check out. Stock: A3 200 → 188.

## 4. Over-stock, warn only — `DEMO-04`

1. Gate: register `DEMO-04`, line **Item A5 × 80** (recorded stock is 60).
   → save succeeds with a low-stock warning toast. No error, no 409.
2. Shed A: confirm **80**.
   → allowed. Stock A5 goes **60 → -20**; ledger `OUT -80`, balance `-20`.
3. Gate: check out `DEMO-04`.
4. Admin → Inventory: `Item A5` shows `-20`. **Stock-in 50** → `30`.
   A positive manual adjust with a reason also works; a negative adjust that would end below zero is
   refused (`409 NEGATIVE_STOCK`), so recover by adding, never by adjusting further down.

Say it out loud: recorded stock may go negative by design; the ledger still balances
(`SUM(delta) = currentStock`).

## 5. Cancellation (optional 5th vehicle) — `DEMO-05`

1. Gate: register `DEMO-05`, line **Item B2 × 5**. Cancel the line before loading.
   → line `CANCELLED`, visit `CANCELLED`, no ledger row, no stock change.

Any 3 of these make a valid pass; §2 is mandatory.

## 6. Expected results at a glance

| Vehicle | Final visit | Lines | Stock proof |
| --- | --- | --- | --- |
| DEMO-01 | `CHECKED_OUT` | A1 `LOADED`/FULL | A1 90 |
| DEMO-02 | `CHECKED_OUT` | A2 `LOADED`, B1 `LOADED` | A2 145, B1 115 |
| DEMO-03 | `CHECKED_OUT` | A3 `LOADED`/SHORT, shortfall 8 | A3 188 |
| DEMO-04 | `CHECKED_OUT` | A5 `LOADED`/FULL, stock negative | A5 -20, then 30 after stock-in |
| DEMO-05 | `CANCELLED` | B2 `CANCELLED` | B2 90, unchanged |

## 7. Admin extras (optional, 60 seconds)

- **Users:** Admin → Users → create a `SHED` user with a shed, edit it, **Disable** it, and show that
  its login now returns a generic `401` while an earlier session gets `403 ACCOUNT_DISABLED`.
  Re-enable it, then **Reset password** and log in with the new one. Do not disable the only admin —
  there is no last-admin protection.
- **Session expiry:** leave one tablet idle until the token expires; the server emits
  `session.expired`, the client logs out, clears its cache and shows a toast. It does not reconnect
  in a loop and does not renew silently — log in again.

## 8. Session and offline behaviour

- Token is memory-only: reload or cold launch = logged out, log in again. Expected, not a bug.
- Offline: red banner `Disconnected — showing last synced data. Actions are disabled.`, mutations
  disabled, no queue. Reconnect → refetch; badge returns to Live.
- Do a 30-second airplane-mode pass on one tablet, then restore and let it refetch before continuing.

## 9. Export checks

Admin → Logs → set a filter (e.g. vehicle `DEMO-02`) → **Export CSV**, then **Export Excel**.

- [ ] Rows match the filtered on-screen table, including `CANCELLED`/`PENDING` lines
- [ ] Timestamps are IST, not UTC
- [ ] CSV opens in Excel/spreadsheet without mojibake (UTF-8 BOM present)
- [ ] A vehicle entered as `=1+1` appears as `'=1+1`, not evaluated
- [ ] Excel file (`logs.xlsx`) has the same columns and row order as the CSV, bold header row
- [ ] Excel keeps `=1+1` as text, not a formula
- [ ] Both exports refuse a non-admin login (`403`)

## 10. Tablet checklist (portrait + landscape)

Not yet run on any device.

- [ ] Installed to home screen, opens standalone, splash + icons correct
- [ ] Touch targets ≥ 44 px; correct keyboard per field (numeric for quantities)
- [ ] Gate form, shed confirm dialog, checkout button all usable one-handed
- [ ] Shed queue shows only that shed's lines; multi-shed vehicle appears on both
- [ ] Live updates across tablets within a second
- [ ] Offline banner legible, reconnect refetch observed
- [ ] Logout → login works per role; cold launch returns to `/login`
