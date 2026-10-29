import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { itemsRoutes } from "./modules/items/items.routes.js";
import { logsRoutes } from "./modules/logs/logs.routes.js";
import { shedsRoutes } from "./modules/sheds/sheds.routes.js";
import {
    requirementLinesRoutes,
    visitsRoutes,
} from "./modules/visits/visits.routes.js";

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
    app.use("/api/visits", visitsRoutes);
    app.use("/api/requirement-lines", requirementLinesRoutes);
    app.use("/api/sheds", shedsRoutes);
    app.use("/api/items", itemsRoutes);
    app.use("/api/logs", logsRoutes);
    app.use("/api/dashboard", dashboardRoutes);

    app.use(notFound);
    app.use(errorHandler);

    return app;
}
