# Phase 03 — Realtime (Socket.IO)

Goal: gate save → shed alert <1s. Socket = invalidation hints only. REST/MySQL stays source of truth.

## 1. Files

- `server/src/config/socket.ts`: `attachSocket(httpServer)` fn.
- Small `emitToRooms(io, rooms, event, payload)` helper in same file.
- Wire in `server/src/index.ts`: build http server from app, attach socket, single listen.

## 2. Auth + rooms

- Handshake: `socket.handshake.auth.token` → verify JWT, disconnect if invalid/expired.
- Rooms assigned server-side from verified identity. Client never picks room.
- Shed user → `shed:{code}`. Gate → `gate`. Admin → `admin`.
- On credential expiry: disconnect socket, client reauths (Phase 04) and reconnects.

## 3. Emit rules

- DB commit first, emit after. Socket failure never rolls back inventory.
- Payloads carry IDs + timestamps only, no balances or sensitive records.

| Trigger | Event | Rooms |
| --- | --- | --- |
| Visit created/cancelled | `requirement.created` / `visit.statusChanged` | each involved `shed:{code}` + `gate` + `admin` |
| Line confirmed/cancelled | `loading.confirmed` + `visit.statusChanged` | `gate` + `admin` (+ shed room for cross-device) |
| Stock changed (confirm, in, adjust, opening) | `stock.updated { itemId }` / `inventory.changed { itemId }` | `gate` + `admin` + affected shed |
| Visit checked out | `visit.statusChanged { CHECKED_OUT }` | all three |

## 4. Limits

- One backend instance. No Redis adapter, no transactional outbox, no offline queues. Documented accepted risk: crash between commit and emit = client recovers on reconnect refetch.

## Verify

- [ ] Two clients: gate creates visit → shed client event <1s
- [ ] Confirm on shed → gate + admin update <1s
- [ ] Kill + reconnect socket → missed changes appear after refetch
- [ ] No API/auth/socket payloads cached anywhere (checked in Phase 04 SW rules)
