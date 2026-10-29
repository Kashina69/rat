export type Role = "ADMIN" | "GATE" | "SHED";

export interface AuthUser {
    id: number;
    name: string;
    username: string;
    role: Role;
    shedId: number | null;
    shedCode: string | null;
}

export interface AuthResponse {
    token: string;
    user: AuthUser;
}

export interface LoginInput {
    username: string;
    password: string;
}

export function roleHome(role: Role): string {
    switch (role) {
        case "ADMIN":
            return "/admin";
        case "GATE":
            return "/gate";
        case "SHED":
            return "/shed";
    }
}
