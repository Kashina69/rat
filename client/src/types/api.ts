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

export type VisitStatus =
    | "AWAITING_LOADING"
    | "PARTIALLY_LOADED"
    | "READY_FOR_CHECKOUT"
    | "CHECKED_OUT"
    | "CANCELLED";

export type LineStatus = "PENDING" | "LOADED" | "CANCELLED";

export type LineDisplay = "PENDING" | "FULL" | "SHORT" | "CANCELLED";

export interface UserRef {
    id: number;
    name: string;
    username: string;
}

export interface Shed {
    id: number;
    name: string;
    code: string;
}

export interface ItemRef {
    id: number;
    name: string;
    category: string;
    unit: string;
    currentStock: number;
    shed: Shed;
}

export interface RequirementLine {
    id: number;
    visitId: number;
    itemId: number;
    shedId: number;
    requestedQty: number;
    loadedQty: number | null;
    status: LineStatus;
    confirmedAt: string | null;
    confirmedBy: UserRef | null;
    item: ItemRef;
    shed: Shed;
    shortfall: number | null;
    display: LineDisplay;
}

export interface Visit {
    id: number;
    vehicleNumber: string;
    driverName: string;
    party: string;
    status: VisitStatus;
    arrivalAt: string;
    checkoutAt: string | null;
    cancelledAt: string | null;
    gateUser: UserRef;
    checkoutByUser: UserRef | null;
    lines: RequirementLine[];
}

export interface CreateVisitWarning {
    itemId: number;
    requested: number;
    available: number;
}

export interface CreateVisitResponse {
    visit: Visit;
    warnings: CreateVisitWarning[];
}

export interface CreateVisitInput {
    vehicleNumber: string;
    driverName: string;
    party: string;
    lines: { itemId: number; qty: number }[];
}

export interface QueueLineVisit {
    id: number;
    vehicleNumber: string;
    driverName: string;
    party: string;
    status: VisitStatus;
    arrivalAt: string;
}

export interface QueueLine extends RequirementLine {
    visit: QueueLineVisit;
}

export interface ShedQueue {
    shed: Shed;
    lines: QueueLine[];
}

export interface InventoryItem {
    id: number;
    name: string;
    category: string;
    unit: string;
    shedId: number;
    currentStock: number;
    reorderLevel: number;
    isActive: boolean;
    shed: Shed;
}

export interface DashboardData {
    insideCount: number;
    perShedPending: {
        shedId: number;
        shedCode: string | null;
        shedName: string | null;
        pendingLines: number;
    }[];
    lowStock: {
        id: number;
        name: string;
        category: string;
        unit: string;
        currentStock: number;
        reorderLevel: number;
        shed: Shed;
    }[];
}

export type LogStatus = "PENDING" | "LOADED" | "CANCELLED";

export interface LogRow {
    lineId: number;
    vehicle: string;
    driver: string;
    party: string;
    arrival: string;
    arrivalIST: string;
    checkout: string | null;
    checkoutIST: string;
    visitStatus: VisitStatus;
    shed: string;
    shedName: string;
    item: {
        id: number;
        name: string;
        category: string;
        unit: string;
    };
    requested: number;
    loaded: number | null;
    shortfall: number | null;
    lineStatus: LogStatus;
    display: LineDisplay;
    gateUser: UserRef;
    confirmedBy: UserRef | null;
    confirmedAt: string | null;
    confirmedAtIST: string;
}

export interface Pagination {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
}

export interface LogFilters {
    vehicle?: string;
    item?: number;
    shed?: string;
    status?: LogStatus;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
}
