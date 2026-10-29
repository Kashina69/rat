export type { Role } from "@prisma/client";

export interface JwtPayload {
    userId: number;
    role: import("@prisma/client").Role;
    shedCode?: string;
}

export interface RequestUser {
    id: number;
    role: import("@prisma/client").Role;
    shedId: number | null;
    shedCode: string | null;
}
