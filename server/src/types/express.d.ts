import type { RequestUser } from "./domain.js";

declare global {
    namespace Express {
        interface Request {
            user?: RequestUser;
            validatedQuery?: unknown;
        }
    }
}

export type { RequestUser };
