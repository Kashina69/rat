# client/ — Next.js 16 PWA

Read `../agents.md` for project-wide rules, `../docs/decisions_made.md` for target
behaviour, and `../docs/project-status.md` for the current state and known
defects. Those two docs override anything you remember about this code.

**Everything in this package is uncommitted working-tree change.** The current
tree typechecks, lints and builds clean (Next 16.4.3, `.next/standalone/server.js`),
but no device has ever run it.

## Next.js version

This is **Next.js 16.4.3** (App Router, React 19.3, React Compiler, Turbopack,
`cacheComponents`, `partialPrefetching`). It is newer than most training data:
when something about routing, caching, `manifest`, service workers or config
misbehaves, read the bundled guide under `node_modules/next/dist/docs/` before
inventing a workaround.

## Layout

```
src/app/            # routes: page.tsx (root redirect), login/, gate/, shed/, admin/, layout.tsx, manifest.ts
src/components/     # by role/feature: gate/, shed/, admin/, common/, layout/, pwa/, ui/
                    #   admin/: DashboardCards, InventoryTable, ItemEditor, StockDialogs, UsersTable, UserEditor, LogsTable
src/hooks/          # useVisits, useItems, useUsers, useLogs, useDashboard, useShedQueue, useSocket, useNetworkStatus, usePwaInstall
src/services/       # thin wrappers over lib/api-client: visits, items, users, logs, sheds
src/providers/      # auth-provider (token+user), socket-provider, query-provider
src/lib/            # api-client, socket-client, query-keys, errors, utils, theme
src/validations/    # zod form schemas mirroring the server validators
src/types/api.ts    # API DTOs
public/             # sw.js, offline.html, icons/
```

## Non-negotiables

- **Server state = TanStack Query.** Keys live in `src/lib/query-keys.ts`; mutations invalidate keys. Never hand-patch cache from socket events — events are invalidation hints, HTTP is the truth. Clear the whole query cache on logout.
- **Token in memory only** (auth context). No `localStorage`/`sessionStorage`; refreshes and cold PWA launches mean relogin, which is intended.
- **All HTTP through** `src/lib/api-client.ts` + `src/services/*`. No `fetch` from components.
- **Client state = context only** (`auth-provider`, `socket-provider`). No Redux/Zustand.
- **Read `code` from `{ error: { code, message } }`**, not message text; show the message via Sonner toast. A `403 ACCOUNT_DISABLED` means the account was disabled mid-session — end the session, do not retry.
- **Functional components only**, no classes, no manual memoisation (React Compiler is on).
- **Tablet-first:** large touch targets, portrait + landscape, visible offline/stale state, confirm destructive actions.
- Role routing is UX only; the server enforces access and shed scoping.

## PWA specifics

- `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` are **inlined at build time** — they must be Docker build args, not runtime env.
- `public/sw.js` is hand-written (no `next-pwa`/Workbox). Never cache API, auth or socket traffic; only the app shell and static assets. Cache-busting is via the worker's version constant.
- Install must **not** call `skipWaiting()`. It now waits, and takes `SKIP_WAITING` only when the user taps; `UpdatePrompt` reloads once, after the user applies. Keep it that way — the bug was a reload mid-form.

## Commands

```bash
export PATH=/home/prince/.nvm/versions/node/v22.23.2/bin:$PATH
npm run dev           # next dev, :3000
npm run typecheck     # tsc --noEmit
npm run lint          # biome check  (npm run format to write)
npm run build         # next build (standalone output)
npm start             # next start
```

## Current state to keep in mind

Verified on the current tree: `typecheck` clean, `lint` clean (69 files),
`build` clean with `.next/standalone/server.js` produced. The server suite
(40/40) covers the API this package calls.

Built and wired in this pass:

- Users screen (`UsersTable`, `UserEditor`, `useUsers`, `services/users.ts`) — list, create, edit role/shed, enable/disable, reset password.
- Excel export button next to CSV in `LogsTable.tsx` (`GET /api/logs/export.xlsx`).
- Session expiry: `socket-provider.tsx` listens for `session.expired`, clears listeners, disconnects, logs out (clearing the query cache) and toasts "Session expired. Sign in again."; transient `connect_error`s still just show disconnected and reconnect.
- Restore action for archived items in `InventoryTable.tsx`; `includeInactive=true` on the admin inventory query.
- Update prompt gated on a waiting worker; signed adjustment uses a text field (iOS minus key).

Still open on this side:

- **No device test at all**: no tablet install, portrait/landscape, offline cold launch or service-worker update on hardware.
- The dashboard shows low stock only — no per-shed current-stock list.
- No route or screen exists for retrying a stock adjustment that would end negative; that is a server rule (`409 NEGATIVE_STOCK`), not a client bug.
