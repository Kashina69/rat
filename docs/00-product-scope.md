> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

# 00 — Product scope

Realtime Ammo Tracking (RAT), proof of concept for **one ammunition depot**: phone calls, paper
slips and guesswork between gate, sheds and office become three browser tablets kept in sync live.
Client brief `docs/RAT_POC_Concept_Document.docx.pdf` (Oct 27 2026); where this page differs, this
page and @docs/decisions_made.md win.

## Who uses it

| Role | Day-to-day user | Scope | Can do |
| --- | --- | --- | --- |
| `ADMIN` | depot officer | whole depot | inventory, stock-in, adjust, archive/restore, logs + CSV/XLSX export, user management, live dashboard |
| `GATE` | gate security / entry clerk | whole depot | register a vehicle with its requirement lines, cancel a pending visit or line, check out a fully loaded vehicle |
| `SHED` | storekeeper, one login per shed | own shed only | incoming queue for that shed, confirm actual loaded quantity, read own stock |

One login per shed: the shed is fixed on the user record and shed scoping is enforced server-side
(item list, dashboard, queue, line confirm); browser role checks are convenience only
(@docs/02-data-model.md).

## The 12 capabilities — ten must-haves, two should-haves

| # | Module | Capability | Tablet | Priority |
| --- | --- | --- | --- | --- |
| 1 | Access | Role login (admin, gate, shed); each shed login tied to its shed; no self-signup | All | Must |
| 2 | Gate | Register arriving vehicle: number, driver, unit/party, arrival time | Gate | Must |
| 3 | Gate | Requirement as item + quantity lines, with a short-stock warning | Gate | Must |
| 4 | Routing | Route each line to the shed holding the item and alert that shed instantly | System / Shed | Must |
| 5 | Shed | Incoming queue; confirm items and actual quantities loaded | Shed | Must |
| 6 | Stock | Deduct stock on confirmation and write one ledger row | System | Must |
| 7 | Gate | Check out only once every shed has confirmed | Gate | Must |
| 8 | Inventory | Create, view, edit, archive items; category, unit, shed, opening stock | Admin | Must |
| 9 | Inventory | Stock received (stock-in) and manual adjustment with a reason | Admin | Must |
| 10 | Logs | In/out log — which vehicle, when, what was loaded, who handled it; filter and search | Admin | Must |
| 11 | Dashboard | Live view of vehicles inside, per-shed status, current stock | Admin | Should |
| 12 | Logs | Export the in/out log to CSV or Excel | Admin | Should |

Eleven are built, plus admin user management; the shortfall is row 11 — the dashboard reports
vehicles inside, pending lines per shed and low stock only, not a per-shed current-stock list
(@docs/project-status.md).

## Multi-shed vehicles

A vehicle may need items from more than one shed, so registration splits the requirement into lines,
each carrying the shed that holds its item:

- `100 × Item A2` from Shed A and `50 × Item B1` from Shed B = two lines, two sheds, one visit.
- Each shed is alerted for its own lines only and cannot complete another shed's line.
- Visit status follows the lines: `AWAITING_LOADING` → `PARTIALLY_LOADED` (some loaded, some pending) → `READY_FOR_CHECKOUT` (nothing pending).
- Checkout is refused (409) until `READY_FOR_CHECKOUT`; a two-shed vehicle is a required success case, not an edge case.

## In scope

- Role login for `ADMIN`, `GATE`, `SHED`, four seeded demo accounts, no self-signup; admin user management (create with role and shed, edit, disable/enable, reset password).
- Vehicle registration with requirement lines (item + quantity), advisory short-stock warnings, cancellation before checkout.
- Line routing to the item's shed, per-shed queue, live alerts on the tablets.
- Confirmation with actual loaded quantity, automatic stock deduction, one append-only ledger row per stock change; strict checkout.
- Inventory create/edit/archive/restore, stock-in, manual adjust with a reason; in/out log with filters and CSV/Excel export on the same filters.
- Dashboard: vehicles inside, per-shed pending lines, low stock.
- Installable tablet PWA: login, offline shell with clearly stale data, mutations blocked offline.

## Out of scope

- Offline mutations or offline stock changes — offline means the app opens, reads are marked stale, nothing can be written.
- Refresh tokens, token revocation, cookie sessions, single sign-on; native apps and app-store releases.
- Redis, transactional outbox, horizontal scaling, multi-instance deploys; any end-user account creation outside the admin.
- Full ERP (purchase orders, indenting, transport billing, HR, e-way bills, reporting beyond the in/out log); real depot data (demo data is synthetic: 2 sheds, 10 items); analytics, forecasting, automatic reorder.

## Success

On a fresh database, from installed tablets:

1. **3–5 vehicles complete the loop** — arrival, requirement, shed alert, confirm, stock deduction, checkout — with no manual data correction.
2. **At least one vehicle needs two sheds** and reaches `PARTIALLY_LOADED` then `READY_FOR_CHECKOUT` before checkout is allowed.
3. **Stock and ledger agree**: for every item, `Σ StockLedger.delta = Item.currentStock`.
4. **The log matches the screen**: CSV and XLSX carry the same rows, columns, order and IST timestamps as the filtered log.
5. **The live link holds**: shed alerts and status changes arrive without a refresh, in portrait and landscape.
6. **Session behaviour is understood**: cold launch needs a fresh login, and an expired session returns to login with no stale data on screen — documented, not a bug.

None of these has been executed yet: no Docker build, no deployment, no tablet install, no 3–5 vehicle
run; code-level results are on @docs/project-status.md.

Related: @docs/01-architecture.md, @docs/02-data-model.md, @docs/decisions_made.md, @docs/project-status.md
