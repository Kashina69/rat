import cors from "cors";
import express, {
    type NextFunction,
    type Request,
    type Response,
} from "express";
import helmet from "helmet";

export function createApp() {
    const app = express();

    app.disable("x-powered-by");
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    app.get("/health", (_req: Request, res: Response) => {
        res.json({ status: "ok", uptime: process.uptime() });
    });

    app.use((_req: Request, res: Response) => {
        res.status(404).json({ error: "Not Found" });
    });

    app.use(
        (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
            console.error(err);
            res.status(500).json({ error: "Internal Server Error" });
        },
    );

    return app;
}
