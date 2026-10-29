import { isApiError } from "@/lib/api-client";

const FRIENDLY: Record<string, string> = {
    UNAUTHORIZED: "Session expired. Please log in again.",
    FORBIDDEN: "You do not have access to this.",
    CROSS_SHED: "This belongs to another shed.",
    NOT_READY: "All lines must be resolved before checkout.",
    NOTHING_LOADED: "No loaded lines to check out.",
    VISIT_CANCELLED: "This visit is cancelled.",
    VISIT_CHECKED_OUT: "This visit is already checked out.",
    VISIT_CLOSED: "This visit is already closed.",
    ALREADY_CANCELLED: "Already cancelled.",
    ALREADY_CHECKED_OUT: "Already checked out.",
    ALREADY_CONFIRMED: "Already confirmed.",
    ALREADY_RESOLVED: "This line is already resolved.",
    HAS_LOADED_LINES: "Cannot cancel: some lines are already loaded.",
    INVALID_QTY: "Loaded qty must be between 1 and requested.",
    INSUFFICIENT_STOCK: "Not enough stock for this load.",
    ITEM_NOT_FOUND: "Item not found.",
    ITEM_INACTIVE: "Item is archived.",
    ITEM_HAS_HISTORY: "Cannot change a used item's name.",
    NEGATIVE_STOCK: "Adjustment would drive stock below zero.",
    VISIT_NOT_FOUND: "Visit not found.",
    LINE_NOT_FOUND: "Line not found.",
    SHED_NOT_FOUND: "Shed not found.",
    DUPLICATE_LINE: "Each item can appear only once per visit.",
    VALIDATION_ERROR: "Please check the highlighted fields.",
    INVALID_ID: "Invalid id.",
};

export function friendlyMessage(error: unknown): string {
    if (isApiError(error)) {
        return FRIENDLY[error.code] ?? error.message;
    }
    if (error instanceof Error) return error.message;
    return "Something went wrong. Try again.";
}
