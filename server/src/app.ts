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
import { usersRoutes } from "./modules/users/users.routes.js";
import {
    requirementLinesRoutes,
    visitsRoutes,
} from "./modules/visits/visits.routes.js";

function trustProxyHops(): number {
    const hops = Number(process.env.TRUST_PROXY ?? "0");
    return Number.isInteger(hops) && hops > 0 ? hops : 0;
}

export function createApp() {
    const app = express();

    app.disable("x-powered-by");
    const hops = trustProxyHops();
    if (hops > 0) {
        app.set("trust proxy", hops);
    }
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
    app.use("/api/users", usersRoutes);

    app.use(notFound);
    app.use(errorHandler);

    return app;
}
