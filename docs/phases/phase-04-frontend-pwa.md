# Phase 04 — Frontend foundation + tablet PWA

Goal: login → role shell works on installed tablet. PWA is core here, not polish. No role screens yet (Phase 05).

## 1. Deps

- `client`: `@tanstack/react-query socket.io-client class-variance-authority clsx tailwind-merge lucide-react react-hook-form zod @hookform/resolvers`

## 2. Folder structure to create and verify

```text
client/src/
  app/login/page.tsx, app/layout.tsx (extend), app/manifest.ts (new), app/page.tsx (role redirect)
  components/ui/ (shadcn: button, input, table, dialog, badge, sonner)
  components/layout/RoleGuard.tsx, components/layout/AppShell.tsx
  components/pwa/ServiceWorkerRegistration.tsx, InstallButton.tsx, ConnectionBadge.tsx, UpdatePrompt.tsx
  hooks/usePwaInstall.ts, hooks/useNetworkStatus.ts
  lib/api-client.ts, lib/socket-client.ts, lib/query-keys.ts
  providers/query-provider.tsx, providers/auth-provider.tsx, providers/socket-provider.tsx
  types/api.ts
client/public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
client/public/sw.js, client/public/offline.html (shell fallback, no data)
```

## 3. Providers + lib

- `api-client.ts`: fetch wrapper, base from env, attach token from auth context, throw typed error on `{ error }`, 401 → logout.
- `query-keys.ts`: visits, shedQueue(code), items, dashboard, logs.
- `socket-client.ts`: connect with token. Reconnect → invalidate queries + refetch.
- `auth-provider.tsx` (Context): user + token in memory only, login/logout. Known limit: cold PWA launch = relogin (documented, tested in demo).
- `socket-provider.tsx` (Context): socket instance, connect on login, disconnect on logout/expiry.
- `RoleGuard.tsx`: redirect by role. UX only, server enforces.
- `query-provider.tsx`: QueryClient, refetch on window focus, no persisted cache.

## 4. PWA contract (Next.js 16 built-in, no next-pwa)

- `manifest.ts`: id stable, name/short_name, start_url `/`, scope `/`, display `standalone`, theme + background colors, 192 + 512 + maskable icons.
- `layout.tsx`: app name + icon metadata, Apple web-app metadata, typed Viewport (`device-width, initialScale 1, viewportFit cover, themeColor`). Pinch zoom stays enabled.
- `sw.js`: production-only, versioned caches. Cache: app shell navigations (network-first + offline fallback), `/_next/static/` hashed assets (cache-first), icons. NEVER intercept/cache: `/api`, auth, Socket.IO, non-GET, RSC/prefetch, TanStack data. Delete old caches on activate. Update flow: detect ready → non-blocking prompt → reload only after user confirms, never mid-mutation.
- Offline = app opens + clear disconnected state. No offline mutations, no queues, no optimistic stock. Visible data labelled stale + last-sync time. Cold offline launch = shell/offline page, not old inventory.
- Connection state from socket/API health, not `navigator.onLine` alone.

## 5. Tablet UI rules

- 44–48px touch targets, large type, high-contrast badges.
- Portrait + landscape, `env(safe-area-inset-*)` padding in standalone.
- No hover-only actions. Numeric keyboard for qty. Disable submit while mutation pending. Keep form values on connection error, never auto-retry unknown-result stock mutation.

## Verify (on real tablet, HTTPS)

- [ ] Install to home screen, cold launch standalone, correct icon/splash
- [ ] Login per role → correct tab (tabs built in Phase 05, shell + redirect now)
- [ ] Portrait/landscape + safe areas correct
- [ ] Offline launch → shell + disconnected banner, no mutations possible
- [ ] Reconnect → socket rejoins, queries refetch, stale label clears
- [ ] SW update → prompt, no forced reload mid-form
- [ ] Cache inspect: zero API/auth/socket/private entries
- [ ] Cold restart → relogin required (accepted) and works
