# server/ — Express 5 + Prisma + MySQL API

> Map: @../index.md, @../agents.md · Truth: @../docs/decisions_made.md, @../docs/project-status.md

Project-wide rules are in `@../agents.md`; this file is server-specific.

## Shape
`src/index.ts` boots (`assertProductionEnv()` → `createApp()` → HTTP + `attachSocket()`); `src/app.ts`
wires middleware, `/health` and the routers; `src/config/env.ts` owns env.
Per module: `<name>.routes.ts` (auth + `requireRole` + validate) → `.controller.ts` (validated input in,
response out) → `.service.ts` (logic + `db.$transaction`, the only place Prisma is used). Zod schemas in
`src/validators/`, helpers in `src/utils/`; register routers in `src/app.ts`.

## Non-negotiables
- `ok` / `okPaginated` / `fail` from `src/utils/responses.ts`; throw `ApiError(code, message, status)` with a stable SCREAMING_SNAKE code.
- **Ledger invariant:** no `item.currentStock` write without its `stockLedger` row in the same
  `$transaction`; use `src/utils/rowLocks.ts` (visit → line → item order) for stock writes.
- Statuses come from the Prisma enums and `src/utils/visitStatus.ts`, never hardcoded.
- Shed scoping is enforced here from the JWT shed code, fail-closed (`403 CROSS_SHED`); `isActive` is
  re-checked per request (`403 ACCOUNT_DISABLED`). No secrets or tokens in logs.

## Commands
```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
npm run dev          # tsx watch, :5000
npm run typecheck    # tsc --noEmit — covers src, tests, prisma/seed.ts
npm run lint         # biome check (npm run format to write)
npm run build        # tsc -p tsconfig.build.json → dist/index.js
npm run db:migrate   # prisma migrate dev     |  db:seed: tsx prisma/seed.ts (-- --reset)
TEST_DATABASE_URL="mysql://rat:rat@127.0.0.1:3306/rat_test" npm test
```

Integration-only tests against a real MySQL `rat_test`, inside the `tsconfig` include so `typecheck` covers
them. `tests/setup-env.ts` maps `TEST_DATABASE_URL` → `DATABASE_URL` and defaults `JWT_SECRET`;
`truncateAll` refuses any database not ending in `_test`. Green run: **12 files / 40 tests**. One squashed
`init` migration — add a new one for schema changes.

Related: @../agents.md, @../docs/02-data-model.md, @../docs/03-api-contract.md
