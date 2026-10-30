import cors from "cors";
import express, { type Request, type Response } from "express";
import helmet from "helmet";
import { corsOptions } from "./config/cors.js";
import { errorHandler, notFound } from "./middlewares/errorHandler.js";
import { apiLimiter } from "./middlewares/limiters.js";
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
    app.set("trust proxy", 1);
    app.use(helmet());
    app.use(cors(corsOptions));
    app.use(express.json({ limit: "100kb" }));
    app.use(express.urlencoded({ extended: false, limit: "100kb" }));
    app.use("/api", apiLimiter);

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
