import "dotenv/config";

export const env = {
    port: Number(process.env.PORT ?? 5000),
    host: process.env.HOST ?? "0.0.0.0",
    nodeEnv: process.env.NODE_ENV ?? "development",
};
