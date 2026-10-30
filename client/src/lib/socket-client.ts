import { io, type Socket } from "socket.io-client";

export type AppSocket = Socket;

export const SOCKET_EVENTS = [
    "requirement.created",
    "loading.confirmed",
    "visit.statusChanged",
    "stock.updated",
    "inventory.changed",
] as const;

export const SESSION_EXPIRED_EVENT = "session.expired";

export function createSocket(token: string): AppSocket {
    const url = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5000";
    return io(url, {
        auth: { token },
        reconnection: true,
        reconnectionDelayMax: 5000,
    });
}
