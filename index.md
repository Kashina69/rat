# Project Index — RAT (Realtime Ammo Tracking) POC

> Read this first. `@path:Lx` means file + 1-based line; open that line directly.
> Rules: `@docs/decisions_made.md` · State: `@docs/project-status.md`.

## Start here

| Need | Jump |
| --- | --- |
| What the product is, roles, 12 capabilities, scope, success | `@docs/00-product-scope.md:L3` |
| System shape, stack, request→transaction→push, modules, strategy, risks | `@docs/01-architecture.md:L3` |
| Entities, statuses, relations, ledger invariant, archive rules | `@docs/02-data-model.md:L3` |
| REST endpoints, roles, errors, socket contract | `@docs/03-api-contract.md:L3` |
| Local setup, env, DB/test DB, login, production deploy | `@docs/04-setup-and-deploy.md:L1` |
| Seed data, reset, five-vehicle demo, exports, tablet checklist | `@docs/05-demo-and-seed.md:L3` |
| Test stack, run command, coverage, invariants, gaps | `@docs/06-testing.md:L1` |
| Decisions and why | `@docs/decisions_made.md:L3` |
| Current status, open items, next order | `@docs/project-status.md:L3` |
| Working instructions for agents | `@agents.md:L1` |
| Server package rules | `@server/agents.md:L1` |
| Client package rules | `@client/agents.md:L1` |
| Original client brief | `@docs/RAT_POC_Concept_Document.docx.pdf` |

## Product and flow

| Topic | Where |
| --- | --- |
| Users and devices | `@docs/00-product-scope.md:L10` |
| The 12 capabilities (10 must, 2 should) | `@docs/00-product-scope.md:L22` |
| Multi-shed vehicle rule | `@docs/00-product-scope.md:L43` |
| In scope / out of scope | `@docs/00-product-scope.md:L53` · `@docs/00-product-scope.md:L63` |
| Success criteria (3–5 vehicles) | `@docs/00-product-scope.md:L70` |
| End-to-end request → transaction → socket push | `@docs/01-architecture.md:L45` |
| Accepted risks and strategy | `@docs/01-architecture.md:L109` · `@docs/01-architecture.md:L120` |

## Data model

| Topic | Where |
| --- | --- |
| Visit and line statuses | `@docs/02-data-model.md:L13` |
| All seven entities | `@docs/02-data-model.md:L38` |
| Relations | `@docs/02-data-model.md:L66` |
| Ledger invariant (± append-only) | `@docs/02-data-model.md:L80` |
| Frozen `shedId` on a line | `@docs/02-data-model.md:L111` |
| Archive/restore rules | `@docs/02-data-model.md:L120` |
| Derived FULL/SHORT/shortfall | `@docs/02-data-model.md:L138` |
| Stock rule (warn-only, negative allowed) | `@docs/decisions_made.md:L15` |
| Schema and stack versions | `@docs/01-architecture.md:L20` |

## API and realtime

| Topic | Where |
| --- | --- |
| Conventions and response envelope | `@docs/03-api-contract.md:L9` |
| Error codes | `@docs/03-api-contract.md:L28` |
| Auth (`login`, `me`) | `@docs/03-api-contract.md:L50` |
| Users (admin) | `@docs/03-api-contract.md:L61` |
| Visits | `@docs/03-api-contract.md:L84` |
| Requirement lines (confirm/cancel) | `@docs/03-api-contract.md:L106` |
| Sheds and queue | `@docs/03-api-contract.md:L122` |
| Items and stock-in/adjust | `@docs/03-api-contract.md:L129` |
| Logs, CSV and XLSX | `@docs/03-api-contract.md:L148` |
| Dashboard and `/health` | `@docs/03-api-contract.md:L173` |
| Socket handshake, rooms, events, `session.expired` | `@docs/03-api-contract.md:L186` |

## Run, deploy, demo, test

| Topic | Where |
| --- | --- |
| Prerequisites and local install | `@docs/04-setup-and-deploy.md:L8` · `@docs/04-setup-and-deploy.md:L16` |
| Server and client env vars | `@docs/04-setup-and-deploy.md:L31` · `@docs/04-setup-and-deploy.md:L46` |
| DB migrate/seed/reset commands | `@docs/04-setup-and-deploy.md:L55` |
| `rat_test` setup | `@docs/04-setup-and-deploy.md:L73` |
| Run both apps | `@docs/04-setup-and-deploy.md:L86` |
| Dev seed passwords | `@docs/04-setup-and-deploy.md:L105` |
| Login, disable, lockout | `@docs/04-setup-and-deploy.md:L121` |
| Production compose, ports, HTTPS, migrations | `@docs/04-setup-and-deploy.md:L142` |
| Seed contents and reset guard | `@docs/05-demo-and-seed.md:L9` · `@docs/05-demo-and-seed.md:L35` |
| Five-vehicle demo | `@docs/05-demo-and-seed.md:L47` |
| Expected statuses and stock deltas | `@docs/05-demo-and-seed.md:L87` |
| Offline / cold launch / expiry | `@docs/05-demo-and-seed.md:L103` |
| CSV and Excel export checks | `@docs/05-demo-and-seed.md:L117` |
| Tablet checklist | `@docs/05-demo-and-seed.md:L129` |
| Run the test suite | `@docs/06-testing.md:L21` |
| Per-file coverage (12 files / 40 tests) | `@docs/06-testing.md:L36` |
| Invariants protected | `@docs/06-testing.md:L56` |
| Open gaps / verification | `@docs/06-testing.md:L76` · `@docs/06-testing.md:L82` |

## State and history

| Topic | Where |
| --- | --- |
| What works / fixed / still open | `@docs/project-status.md:L11` · `@docs/project-status.md:L28` · `@docs/project-status.md:L38` |
| Phase status | `@docs/project-status.md:L52` |
| Verification commands and results | `@docs/project-status.md:L63` |
| Recommended next order | `@docs/project-status.md:L83` |
| Decision log | `@docs/decisions_made.md:L13` |
| Original spec and phase plans | git history only; do not implement from them |

## Code Map (Direct Implementation)

| Feature / Domain | Client UI & Components | Client State & Storage | Server Module (Route / Service) | Key Invariant / Verification |
|---|---|---|---|---|
| **Auth & Session** | `client/src/app/login/page.tsx:L20`<br>`client/src/components/layout/RoleGuard.tsx:L14` | `client/src/providers/auth-provider.tsx:L45`<br>`client/src/lib/api-client.ts:L38`<br>Storage: `rat_token`, `rat_user` | `server/src/modules/auth/auth.routes.ts:L10`<br>`server/src/modules/auth/auth.service.ts:L6` | Verified via `GET /api/auth/me`. Rehydrates on mount before guards run. |
| **Visits / Gate** | `client/src/app/gate/page.tsx:L10`<br>`client/src/components/gate/VehicleForm.tsx:L12` | `client/src/hooks/useVisits.ts:L1`<br>`client/src/services/visits.ts:L1` | `server/src/modules/visits/visits.routes.ts:L16`<br>`server/src/modules/visits/visits.service.ts:L20` | Stock check at gate is warn-only. Recalculates status upon checkout/cancel. |
| **Shed & Queue** | `client/src/app/shed/page.tsx:L25`<br>`client/src/components/shed/ConfirmDialog.tsx:L10` | `client/src/hooks/useShedQueue.ts:L1`<br>`client/src/services/sheds.ts:L1` | `server/src/modules/sheds/sheds.routes.ts:L10`<br>`server/src/modules/visits/visits.service.ts:L65` (`confirmLine`) | Transactional decrement under `rowLocks.ts`. `OUT` ledger row written synchronously. |
| **Inventory & Stock** | `client/src/app/admin/page.tsx:L20`<br>`client/src/components/admin/InventoryTable.tsx:L10` | `client/src/hooks/useItems.ts:L1`<br>`client/src/services/items.ts:L1` | `server/src/modules/items/items.routes.ts:L15`<br>`server/src/modules/items/items.service.ts:L20` | `SUM(ledger.delta) == currentStock`. Stock-in / adjust write ledger rows. |
| **User Management** | `client/src/app/admin/page.tsx:L35`<br>`client/src/components/admin/UsersTable.tsx:L15` | `client/src/hooks/useUsers.ts:L1`<br>`client/src/services/users.ts:L1` | `server/src/modules/users/users.routes.ts:L14`<br>`server/src/modules/users/users.service.ts:L15` | Admin only (`requireRole("ADMIN")`). Disabled user gets immediate `403 ACCOUNT_DISABLED`. |
| **Logs & Export** | `client/src/app/admin/page.tsx:L50`<br>`client/src/components/admin/LogsTable.tsx:L10` | `client/src/hooks/useLogs.ts:L1`<br>`client/src/services/logs.ts:L1` | `server/src/modules/logs/logs.routes.ts:L15`<br>`server/src/modules/logs/logs.service.ts:L20` | Filtered by vehicle/item/shed/dates (IST day bounds). Exports CSV and `.xlsx`. |
| **Dashboard** | `client/src/app/admin/page.tsx:L15`<br>`client/src/components/admin/DashboardCards.tsx:L10` | `client/src/hooks/useDashboard.ts:L1` | `server/src/modules/dashboard/dashboard.routes.ts:L10`<br>`server/src/modules/dashboard/dashboard.service.ts:L10` | Vehicles inside, pending lines per shed, low stock (`currentStock <= reorderLevel`). |
| **Sockets & Sync** | `client/src/providers/socket-provider.tsx:L36`<br>`client/src/components/pwa/ConnectionBadge.tsx:L5` | `client/src/lib/socket-client.ts:L15`<br>`client/src/hooks/useSocket.ts:L5` | `server/src/config/socket.ts:L20` | Sockets emit after DB commit. Triggers TanStack `queryClient.invalidateQueries()`. |

## Symptom → Triage Map (Debug in 3 reads)

| Symptom / Issue | Primary Files to Inspect | Scope & Blast Radius | What to check |
|---|---|---|---|
| **Logout on page refresh** | `client/src/providers/auth-provider.tsx`<br>`client/src/components/layout/RoleGuard.tsx`<br>`client/src/app/login/page.tsx` | **Client only** (backend `/api/auth/me` exists and is complete; do not touch server or sockets) | Read session from `localStorage` on mount, gate guards on `initializing`, call `meRequest()`. |
| **Account disabled but still acting** | `server/src/middlewares/auth.ts`<br>`client/src/lib/api-client.ts`<br>`client/src/providers/auth-provider.tsx` | **Client fetch + Server auth** (socket handles `session.expired` automatically) | Verify `auth.ts` re-reads user row and returns `403 ACCOUNT_DISABLED`; verify `api-client.ts` catches 403 and fires `onUnauthorized()`. |
| **Stale list / Screen not updating after change** | `client/src/providers/socket-provider.tsx`<br>`server/src/config/socket.ts`<br>`client/src/lib/query-keys.ts` | **Client cache invalidation** (REST DB writes are already synchronous) | Verify server emitted event after transaction commit; verify `socket-provider.tsx` invalidates correct queryKey. |
| **Shed confirmation fails or race condition** | `server/src/modules/visits/visits.service.ts` (`confirmLine`)<br>`server/src/utils/rowLocks.ts`<br>`client/src/components/shed/ConfirmDialog.tsx` | **Server transaction** | Check lock order (visit → line → item); ensure `P2034` deadlock retry; verify double-confirm returns 409. |
| **403 CROSS_SHED error** | `server/src/middlewares/auth.ts`<br>`server/src/modules/sheds/sheds.service.ts`<br>`server/src/modules/items/items.service.ts` | **Server authorization only** | Ensure token contains `shedCode`; check fail-closed check comparing user shed with requested resource. |
| **Stock numbers mismatch ledger** | `server/src/utils/rowLocks.ts`<br>`server/src/modules/items/items.service.ts`<br>`server/tests/ledger-invariant.test.ts` | **Server database only** | Run ledger invariant test; check if any path modifies `item.currentStock` without inserting a `stockLedger` row in the same transaction. |

## Entry points

| File | Purpose |
| --- | --- |
| `@readme.md:L1` | What it is, roles/loop, quickstart, demo logins |
| `@agents.md:L7` | Read order, conventions, commands, rules |
| `@server/agents.md:L7` | Server shape, non-negotiables, commands |
| `@client/agents.md:L7` | Client shape, non-negotiables, commands |
| `@claude.md:L1` | 1-line alias for `agents.md` |

Related: @readme.md, @agents.md, @docs/decisions_made.md, @docs/project-status.md
