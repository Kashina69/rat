# Phase 06 — Hardening + public demo

Goal: secure public link, fresh DB → full demo passes.

## 1. Backend

- Login rate-limit, exact-origin CORS, request-size limits, helmet, zod on all writes.
- Central error handler: no stack traces / secrets in production.
- Production startup rejects default credentials + weak JWT secret.
- Demo seed uses env-supplied strong passwords, synthetic vehicles/items only. No real depot data.
- Seed reset: `prisma/seed.ts` runnable to wipe + reseed demo.

## 2. Frontend

- Loading / empty / error states on every query. Sonner toasts on all mutations.
- PWA icons + splash verified on target tablets (done in Phase 04, re-verify after any shell change).

## 3. Concurrency tests (real MySQL, before sign-off)

- Two concurrent confirms of one line → one success, one 409, one deduction.
- Competing visits, insufficient stock → no negative balance.
- Forced ledger failure → stock + line roll back.
- Concurrent multi-shed confirms → correct final status.
- Duplicate checkout → one transition, one audit.
- `SUM(delta) == currentStock` for all items.
- Cross-shed API + socket access denied.

## 4. Deploy

- Containerized, India region, HTTPS (required for PWA + secure cookies if adopted).
- Env: managed MySQL URL, JWT_SECRET (long random), CORS_ORIGIN (frontend URL), demo passwords.
- Same-origin serve for frontend + `/api` + `/socket.io` if cookie session adopted; exact-origin CORS either way.

## 5. Final acceptance

- [ ] Fresh migrate + seed → scripted 3–5 vehicle demo passes, single + multi-shed
- [ ] Cold PWA launch → documented session behavior, relogin works
- [ ] Offline → blocked mutations, stale labels, reconnect refetch
- [ ] SW update → prompt, no interrupted operation
- [ ] CSV export matches screen filters, formula cells escaped
- [ ] Tablet portrait/landscape, touch targets, keyboards verified
