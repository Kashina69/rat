# client/ — Next.js 16 PWA

> Map: @../index.md, @../agents.md · Truth: @../docs/decisions_made.md, @../docs/project-status.md

Project-wide rules are in `@../agents.md`; this file is client-specific.

## Shape
`src/app/` holds the routes (`login/`, `gate/`, `shed/`, `admin/`, `manifest.ts`); `components/` is grouped
by role/feature (`gate/`, `shed/`, `admin/`, `common/`, `pwa/`, `ui/`); `hooks/` holds the queries;
`services/` wrap `lib/api-client.ts`; `providers/` holds `auth-provider`, `socket-provider`; `lib/` holds
`api-client`, `socket-client`, `query-keys`; `validations/` mirrors the server schemas; `public/` holds
`sw.js`, `offline.html`, icons.

Next 16.4.3 (App Router, React 19, React Compiler): for routing, caching, `manifest` or service-worker oddities read `node_modules/next/dist/docs/` first.

## Non-negotiables
- **Server state = TanStack Query.** Keys in `src/lib/query-keys.ts`; mutations invalidate keys and never
  hand-patch the cache. Socket events are hints only; clear the cache on logout.
- **Token in memory only** (auth context). No `localStorage`/`sessionStorage`; a refresh or cold launch
  means relogin, by design. All HTTP through `src/lib/api-client.ts` + `src/services/*`.
- Read `code` from `{ error: { code, message } }`, not the message; show it via Sonner. `403 ACCOUNT_DISABLED` ends the session — do not retry.
- Functional components, no classes, no manual memoisation. Tablet-first: large targets, both
  orientations, visible offline state, confirm destructive actions. Role routing is UX only.
- `NEXT_PUBLIC_*` URLs are inlined at build time — Docker build args, not runtime env. `public/sw.js` is
  hand-written: never cache API, auth or socket traffic, and install never calls `skipWaiting()`.

## Commands
```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
npm run dev           # next dev, :3000
npm run typecheck     # tsc --noEmit
npm run lint          # biome check (npm run format to write)
npm run build         # next build (standalone output)
```

No client tests; the server suite (12 files / 40 tests) covers the API this package calls. Device
behaviour (install, offline, service-worker update) is manual only.

Related: @../agents.md, @../docs/03-api-contract.md, @../docs/06-testing.md
