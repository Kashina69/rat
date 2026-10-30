# 00 — Product scope

Depot Management System (DMS), proof of concept for one ammunition depot. The
system replaces phone calls and paper slips between the gate, the storage sheds,
and the depot office with three browser tablets that stay in sync live.

Source material: `docs/DMS_POC_Concept_Document.docx.pdf` (client-facing concept,
Oct 27 2026). Where this page and that document disagree, this page and
`docs/decisions_made.md` win.

## Who uses it

| Role | Day-to-day user | Sees | Can do |
| --- | --- | --- | --- |
| `ADMIN` | depot officer / officer in charge | every vehicle, all items, logs, dashboard | manage inventory, stock-in, adjust, archive and restore, read and export logs (CSV, XLSX), manage users, watch the depot live |
| `GATE` | gate security / entry clerk | arriving and inside vehicles, items | register a vehicle with its requirement lines, cancel a pending visit or line, check out a fully loaded vehicle |
| `SHED` | shed storekeeper, one login per shed | only their own shed | see the incoming queue for their shed, confirm actual loaded quantity, read their own stock |

One login per shed is the rule: a shed user's `shedId` is fixed on the user
record and shed-scoped reads and writes are filtered server-side (item list,
dashboard, queue, line confirm). Role checks in the browser are convenience only.

## The capabilities (12)

Ten must-haves and two should-haves, straight from the concept document. The
"State in this repo" column is the current truth; `docs/project-status.md` has the
detail.

| # | Module | Capability | Tablet | Priority | State in this repo |
| --- | --- | --- | --- | --- | --- |
| 1 | Access | Role-based login (admin, gate, shed); each shed login tied to its shed | All | Must | Built. JWT in memory, no self-signup. Admin user management is built too: create user, assign role + shed, disable/enable, reset password |
| 2 | Gate | Register arriving vehicle: vehicle number, driver, unit or party, arrival time | Gate | Must | Built |
| 3 | Gate | Enter requirement as item + quantity lines; warn when stock is short | Gate | Must | Built. Warning only, never blocks the save |
| 4 | Routing | Route each line to the shed that holds the item and alert that shed instantly | System / Shed | Must | Built. Line's shed is frozen from the item at creation |
| 5 | Shed | Incoming queue; confirm items and actual quantities loaded | Shed | Must | Built |
| 6 | Stock | Deduct stock on confirmation and write a ledger row | System | Must | Built. Append-only ledger written in the same transaction |
| 7 | Gate | Check out only once every shed has confirmed | Gate | Must | Built. Strict: 409 unless the visit is `READY_FOR_CHECKOUT` |
| 8 | Inventory | Create, view, edit, archive items; category, unit, shed, opening stock | Admin | Must | Built. Name, category and reorder level editable at any time; unit and shed fixed at creation; archive and restore both available to admin |
| 9 | Inventory | Record stock received (stock-in) and manual adjustment with a reason | Admin | Must | Built. Adjustment rejects qty 0 and any result below zero |
| 10 | Logs | In/out log — which vehicle, when, what was loaded, who handled it; filter and search | Admin | Must | Built (`GET /api/logs`) |
| 11 | Dashboard | Live view of vehicles inside, per-shed status, current stock | Admin | Should | Partly built. Inside count, per-shed pending, low stock; **no per-shed current-stock list** |
| 12 | Logs | Export the in/out log to CSV or Excel | Admin | Should | Built. `GET /api/logs/export` (CSV) and `GET /api/logs/export.xlsx`, same filters, columns, IST timestamps and order as the screen |

The one capability still short of the concept is the dashboard current-stock
list (row 11): `GET /api/dashboard` returns only low-stock items
(`currentStock <= reorderLevel`), not every item's stock per shed. The full list
is available to admin through `GET /api/items`.

Current defects and gaps are tracked on `docs/project-status.md`, not here.

## Multi-shed rule

A vehicle may need items from more than one shed. The system handles this by
splitting the requirement into lines, each carrying the shed that holds its item:

- Registering `100 × Item A2` from Shed A and `50 × Item B1` from Shed B creates
  two lines, in two sheds, on one visit.
- Shed A and Shed B are each alerted for their own lines only.
- The visit is `AWAITING_LOADING` until someone confirms, `PARTIALLY_LOADED` once
  at least one line is loaded and one is still pending, and
  `READY_FOR_CHECKOUT` only when no lines are pending.
- Checkout is refused with 409 until the visit is `READY_FOR_CHECKOUT`, and no
  single shed can complete another shed's line.

A vehicle from two sheds is a required success case, not an edge case.

## In scope for the POC

- Role login for `ADMIN`, `GATE`, `SHED`; four seeded demo accounts.
- Admin user management: create a user with role and shed, rename, change role
  or shed, disable/enable, reset a password. No self-signup.
- Vehicle registration with vehicle number, driver, party, arrival time.
- Requirement lines with item and quantity; advisory short-stock warnings.
- Line routing to the item's shed, per-shed incoming queue, live alerts.
- Confirmation with actual loaded quantity; automatic stock deduction; one
  append-only ledger row per stock change.
- Strict checkout after all sheds finish; visit and line cancellation before
  checkout.
- Inventory create/edit/archive/restore, stock-in, manual adjustment with a
  reason.
- In/out log with vehicle, item, shed, status and date filters, plus CSV and
  Excel export using the same filters.
- Dashboard: vehicles inside, per-shed pending lines, low stock.
- Installable tablet PWA: login, offline shell with clearly stale data, blocked
  mutations while offline.

## Out of scope

- Offline mutation queues or offline stock changes. Offline means the app opens
  and reads are marked stale; nothing can be written.
- Refresh tokens, token revocation, cookie sessions, single sign-on.
- Redis, a transactional outbox, horizontal scaling or multi-instance deploys.
- Native iOS/Android apps, app-store releases.
- Self-signup or any account creation flow for end users outside the admin.
- Full ERP features: purchase orders, indenting, transport billing, HR, e-way
  bills, reporting beyond the in/out log.
- Real depot data. Demo data is synthetic (2 sheds, 10 items).
- Real-time analytics, forecasting, automatic reorder generation.

## Success criteria

The POC passes when, on a fresh database and from installed tablets:

1. **3–5 vehicles complete the full loop** — arrival, requirement, shed alert,
   confirm, stock deduction, checkout — with no manual data correction.
2. **At least one of those vehicles needs items from two sheds**, and the visit
   reaches `PARTIALLY_LOADED` then `READY_FOR_CHECKOUT` before checkout is
   allowed.
3. **Stock and ledger agree**: for every item, `Σ StockLedger.delta` equals
   `Item.currentStock`.
4. **The log matches the screen**: the CSV and the XLSX export contain exactly
   what the filtered log shows — same rows, columns, order and IST timestamps.
5. **The live link holds up**: shed alert and status changes arrive without a
   refresh, on the tablets, in portrait and landscape.
6. **Session behaviour is understood**: cold launch of the installed app requires
   a fresh login (token lives in memory only), and an expired session returns the
   user to the login screen with no stale data left on screen — documented, not
   a bug.

These criteria have **not been executed yet**: no Docker build, no deployment, no
tablet install, no 3–5 vehicle demo run, and no device/PWA update/offline test
has been performed. The code-level checks that do pass (tests, typecheck, lint,
build) are on `docs/project-status.md`.

`docs/demo-script.md` is the scripted version of this checklist.

## Related documents

- `docs/DMS_POC_Concept_Document.docx.pdf` — original concept and capability
  table.
- `docs/decisions_made.md` — every accepted decision (MySQL over PostgreSQL,
  warn-only short stock, item edit rules, session model, export formats, user
  management).
- `docs/01-architecture.md` — how the loop is wired.
- `docs/02-data-model.md` — the schema behind the rules.
- `docs/03-api-contract.md` — the endpoints the tablets call.
- `docs/project-status.md` — what actually works today, and what does not.
