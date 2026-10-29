import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export function createApp() {
    const app = express();

    app.disable("x-powered-by");
    app.use(helmet());
    app.use(cors({ origin: env.corsOrigin }));
    app.use(express.json());

    app.get("/health", (_req: Request, res: Response) => {
        res.json({ data: { status: "ok", uptime: process.uptime() } });
    });

    app.use("/api/auth", authRoutes);

    app.use(notFound);
    app.use(errorHandler);

    return app;
}
