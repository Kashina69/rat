import "dotenv/config";

function requireEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
}

const WEAK_SECRETS = new Set([
    "change-me",
    "change-me-to-a-long-random-string",
    "password",
    "secret",
    "test",
    "rat-secret",
]);

function isWeakSecret(secret: string): boolean {
    return secret.length < 32 || WEAK_SECRETS.has(secret.toLowerCase());
}

export const env = {
    port: Number(process.env.PORT ?? 5000),
    host: process.env.HOST ?? "0.0.0.0",
    nodeEnv: process.env.NODE_ENV ?? "development",
    databaseUrl: requireEnv("DATABASE_URL"),
    jwtSecret: requireEnv("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "8h",
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
};

export function assertProductionEnv(): void {
    if (env.nodeEnv !== "production") {
        return;
    }
    if (isWeakSecret(env.jwtSecret)) {
        throw new Error(
            "Refusing to start: JWT_SECRET is missing, too short (<32 chars), or a known default. Set a long random value.",
        );
    }
    if (env.corsOrigin === "*" || parseOrigins(env.corsOrigin).length === 0) {
        throw new Error(
            "Refusing to start: CORS_ORIGIN must be an explicit origin allowlist in production (comma-separated, no *).",
        );
    }
}

function parseOrigins(raw: string): string[] {
    return raw
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0);
}
