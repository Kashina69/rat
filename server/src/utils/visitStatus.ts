import type { RequirementLineStatus, VisitStatus } from "@prisma/client";

export function recalcVisitStatus(
    lineStatuses: RequirementLineStatus[],
): VisitStatus {
    if (
        lineStatuses.length > 0 &&
        lineStatuses.every((status) => status === "CANCELLED")
    ) {
        return "CANCELLED";
    }
    const pending = lineStatuses.filter(
        (status) => status === "PENDING",
    ).length;
    const loaded = lineStatuses.filter((status) => status === "LOADED").length;
    if (pending === 0 && loaded >= 1) {
        return "READY_FOR_CHECKOUT";
    }
    if (loaded >= 1 && pending >= 1) {
        return "PARTIALLY_LOADED";
    }
    return "AWAITING_LOADING";
}
