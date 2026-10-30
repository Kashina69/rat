import { db } from "../../config/db.js";
import type { RequestUser } from "../../types/domain.js";
import { ApiError } from "../../utils/errors.js";
import { lineInclude, toLineDto } from "../visits/visits.dto.js";

export async function listSheds() {
    return db.shed.findMany({ orderBy: { code: "asc" } });
}

export async function getShedQueue(code: string, caller: RequestUser) {
    const shed = await db.shed.findUnique({ where: { code } });
    if (!shed) {
        throw new ApiError("SHED_NOT_FOUND", "Shed not found", 404);
    }
    if (
        caller.role === "SHED" &&
        (caller.shedId === null || caller.shedId !== shed.id)
    ) {
        throw new ApiError(
            "CROSS_SHED",
            "Cannot view another shed's queue",
            403,
        );
    }
    const lines = await db.requirementLine.findMany({
        where: {
            shedId: shed.id,
            status: "PENDING",
            visit: { status: { notIn: ["CHECKED_OUT", "CANCELLED"] } },
        },
        include: {
            ...lineInclude,
            visit: {
                select: {
                    id: true,
                    vehicleNumber: true,
                    driverName: true,
                    party: true,
                    status: true,
                    arrivalAt: true,
                },
            },
        },
        orderBy: [{ visit: { arrivalAt: "asc" } }, { id: "asc" }],
    });
    return {
        shed,
        lines: lines.map((line) => ({
            ...toLineDto(line),
            visit: line.visit,
        })),
    };
}
