# AGENTS.md — working in this repo

> Map: @index.md · Truth: @docs/decisions_made.md, @docs/project-status.md

Instructions for anyone (human or agent) changing the Realtime Ammo Tracking (RAT) POC. What the product is: `@readme.md`.

## Read order

1. `@index.md` — topic → `file:line`. Start here instead of scanning the tree.
2. `@docs/decisions_made.md` (what it must do) and `@docs/project-status.md` (what actually works,
   open gaps) — these override anything you remember and any stale doc. If code disagrees with
   `decisions_made.md`, the decision file is the target and `project-status.md` should list the gap.
3. Only the reference doc for the area you are touching — see the doc map below.

## Repo layout

```text
server/  src/app.ts, src/index.ts, config/, middlewares/, prisma/, tests/, utils/, validators/,
         modules/<name>/ (routes → controller → service)
client/  src/app/ (login, gate, shed, admin), components/ by role/feature, hooks/, services/,
         providers/, lib/, validations/, public/ (sw.js, offline.html)
docs/    reference set + the two truth files
```

## Backend conventions

- **Flow is fixed:** `route → controller → service → Prisma`. Routes wire auth, role and validation;
  controllers read validated input and shape the response; services hold logic and `db.$transaction`.
- A feature is `src/modules/<name>/` (routes, controller, service, optional `.dto.ts`),
  `src/validators/<name>.schemas.ts`, and one registration line in `src/app.ts`.
- **Functional style, zod at every boundary.** No classes — the only one is `ApiError`
  (`src/utils/errors.ts`). Input passes `validate` / `validateQuery`; services take `z.infer` types.
- **Response shape:** `{ data }` (`ok`), `{ data, pagination }` (`okPaginated`), `{ error: { code, message } }`
  (`fail` / `ApiError`). Codes are SCREAMING_SNAKE (`INVALID_QTY`, `CROSS_SHED`); match on `code`, not text.
- **Ledger invariant:** never write `item.currentStock` without its `stockLedger` row in the same
  transaction; `SUM(ledger.delta) == currentStock` must hold. Use `src/utils/rowLocks.ts` for
  read-then-write stock paths and `src/utils/visitStatus.ts` instead of status strings.
- **Shed scoping is server-side.** Every `SHED`-reachable route filters on the token's shed and fails closed
  (`403 CROSS_SHED`) when the claim is missing. Client checks are UX only.
- **No secrets in logs** — no tokens, passwords, `DATABASE_URL`, `JWT_SECRET` or `SEED_*` values anywhere.

## Frontend conventions

- **Server state is TanStack Query.** Keys in `src/lib/query-keys.ts`; mutations invalidate keys, never
  hand-patch. Socket events are invalidation hints only. Client state is context only; no Redux/Zustand.
- **Token in memory only** (`auth-provider`), never `localStorage`/`sessionStorage` — a refresh relogins.
  All HTTP through `src/lib/api-client.ts` + `src/services/*`.
- Functional components, no classes, no manual memoisation (React Compiler is on); zod forms in
  `src/validations/`. Tablet-first: large targets, both orientations, visible offline state.

| Task                     | Command                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| DB up · migrate · seed | `docker compose up -d mysql` · `cd server && npm run db:migrate` · `npm run db:seed -- --reset`              |
| Dev                      | `cd server && npm run dev` (:5000) · `cd client && npm run dev` (:3000)                                         |
| Typecheck                | `cd server && npm run typecheck` · `cd client && npm run typecheck` (both `tsc --noEmit`)                     |
| Lint / format            | `npm run lint` (Biome) · `npm run format` in the package you touched                                            |
| Tests                    | `cd server && TEST_DATABASE_URL="mysql://rat:rat@127.0.0.1:3306/rat_test" npm test` — see `@docs/06-testing.md` |
| Build                    | `cd server && npm run build` (→ `dist/index.js`) · `cd client && npm run build` (standalone)                 |

Run `typecheck` and `lint` in every package you touched; no long-lived servers or Docker builds unless asked.

## Rules

- **Update the docs with the behaviour.** A change to rules, statuses, API shape or what actually works
  updates `@docs/decisions_made.md` and/or `@docs/project-status.md` in the same change — never leave a
  doc claiming a broken feature works.
- **No commits, no pushes** unless asked — no history rewriting, no branch surgery.
- No classes, no over-engineering, no comments unless the logic is not self-evident; match Biome formatting.
- **Don't invent scope.** User management and `.xlsx` export are built; offline queues, refresh tokens,
  Redis, a full stock dashboard and native apps are out. Stay inside the files your task assigns.

## Doc map

| Doc                                                        | Job                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `@index.md`                                              | topic → file:line lookup                                         |
| `@docs/decisions_made.md` · `@docs/project-status.md` | authoritative decisions · authoritative state                    |
| `@docs/00-product-scope.md` … `@docs/06-testing.md`   | scope, architecture, data model, API, setup/deploy, demo, testing |
| `@server/agents.md` · `@client/agents.md`             | package conventions and commands                                  |

The original spec and the phase plans are in git history; do not implement from them.

Related: @index.md, @readme.md, @docs/decisions_made.md
