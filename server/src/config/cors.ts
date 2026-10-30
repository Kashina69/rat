import type { CorsOptions } from "cors";
import { env } from "./env.js";

export function parseOrigins(raw: string): string[] {
    return raw
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
}

export function isOriginAllowed(origin: string | undefined): boolean {
    if (!origin) {
        return true;
    }
    return parseOrigins(env.corsOrigin).includes(origin);
}

export const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
            callback(null, true);
            return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
    maxAge: 600,
};
