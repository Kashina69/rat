import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./env.js";

export function createSocketServer(httpServer: HttpServer) {
    const io = new Server(httpServer, {
        cors: { origin: env.corsOrigin },
    });
    return io;
}
