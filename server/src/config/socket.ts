import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { JwtPayload, RequestUser } from "../types/domain.js";
import { verifyToken } from "../utils/jwt.js";
import { isOriginAllowed } from "./cors.js";
import { db } from "./db.js";

export const GATE_ROOM = "gate";
export const ADMIN_ROOM = "admin";

export function shedRoom(code: string) {
    return `shed:${code}`;
}

export function roomsForSheds(codes: Array<string | null | undefined>) {
    const sheds = [
        ...new Set(codes.filter((code): code is string => Boolean(code))),
    ].map(shedRoom);
    return [GATE_ROOM, ADMIN_ROOM, ...sheds];
}

let io: Server | null = null;

export function getIo() {
    return io;
}

export function emitToRooms(
    server: Server | null,
    rooms: string[],
    event: string,
    payload: unknown,
) {
    if (!server || rooms.length === 0) {
        return;
    }
    try {
        server.to(rooms).emit(event, payload);
    } catch {
        // Socket failure never rolls back inventory.
    }
}

export function attachSocket(httpServer: HttpServer) {
    const server = new Server(httpServer, {
        cors: {
            origin: (origin, callback) => {
                if (isOriginAllowed(origin)) {
                    callback(null, true);
                    return;
                }
                callback(new Error(`Origin not allowed: ${origin}`));
            },
            methods: ["GET", "POST"],
        },
    });
    io = server;

    server.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;
        if (typeof token !== "string" || token.length === 0) {
            return next(new Error("UNAUTHORIZED"));
        }
        try {
            const payload = verifyToken(token);
            const user = await db.user.findUnique({
                where: { id: payload.userId },
                include: { shed: true },
            });
            if (!user) {
                return next(new Error("UNAUTHORIZED"));
            }
            socket.data.user = {
                id: user.id,
                role: user.role,
                shedId: user.shedId,
                shedCode: user.shed?.code ?? null,
            } satisfies RequestUser;
            const exp = (payload as JwtPayload & { exp?: number }).exp;
            if (exp !== undefined) {
                const delay = exp * 1000 - Date.now();
                if (delay <= 0) {
                    return next(new Error("UNAUTHORIZED"));
                }
                const timer = setTimeout(() => socket.disconnect(true), delay);
                socket.on("disconnect", () => clearTimeout(timer));
            }
            return next();
        } catch {
            return next(new Error("UNAUTHORIZED"));
        }
    });

    server.on("connection", (socket) => {
        const user = socket.data.user as RequestUser | undefined;
        if (!user) {
            socket.disconnect(true);
            return;
        }
        if (user.role === "SHED") {
            if (!user.shedCode) {
                socket.disconnect(true);
                return;
            }
            socket.join(shedRoom(user.shedCode));
        } else if (user.role === "GATE") {
            socket.join(GATE_ROOM);
        } else if (user.role === "ADMIN") {
            socket.join(ADMIN_ROOM);
        } else {
            socket.disconnect(true);
        }
    });

    return server;
}
