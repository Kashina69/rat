import type { Prisma } from "@prisma/client";
import { db } from "../../config/db.js";
import { writeAudit } from "../../utils/audit.js";
import { ApiError } from "../../utils/errors.js";
import { hashPassword } from "../../utils/password.js";
import type {
    CreateUserInput,
    ResetPasswordInput,
    UpdateUserInput,
} from "../../validators/users.schemas.js";

const userSelect = {
    id: true,
    name: true,
    username: true,
    role: true,
    shedId: true,
    isActive: true,
    shed: { select: { code: true, name: true } },
} satisfies Prisma.UserSelect;

export async function listUsers() {
    return db.user.findMany({
        select: userSelect,
        orderBy: [{ role: "asc" }, { username: "asc" }],
    });
}

async function getExistingUser(userId: number) {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, shedId: true, isActive: true },
    });
    if (!user) {
        throw new ApiError("USER_NOT_FOUND", "User not found", 404);
    }
    return user;
}

async function assertShedExists(shedId: number) {
    const shed = await db.shed.findUnique({
        where: { id: shedId },
        select: { id: true },
    });
    if (!shed) {
        throw new ApiError("SHED_NOT_FOUND", "Shed not found", 404);
    }
}

export async function createUser(input: CreateUserInput, actorId: number) {
    const shedId = input.role === "SHED" ? (input.shedId ?? null) : null;
    if (shedId === null && input.role === "SHED") {
        throw new ApiError(
            "SHED_REQUIRED",
            "A shed is required for the SHED role",
            400,
        );
    }
    if (shedId !== null) {
        await assertShedExists(shedId);
    }
    const passwordHash = await hashPassword(input.password);
    return db.$transaction(async (tx) => {
        const created = await tx.user.create({
            data: {
                name: input.name,
                username: input.username,
                passwordHash,
                role: input.role,
                shedId,
            },
            select: userSelect,
        });
        await writeAudit(tx, {
            userId: actorId,
            action: "USER_CREATED",
            entity: "User",
            entityId: created.id,
        });
        return created;
    });
}

function nextShedId(
    current: { role: string; shedId: number | null },
    input: UpdateUserInput,
    role: string,
) {
    if (role !== "SHED") {
        if (input.shedId !== undefined && input.shedId !== null) {
            throw new ApiError(
                "SHED_NOT_ALLOWED",
                "A shed can only be assigned to the SHED role",
                400,
            );
        }
        return null;
    }
    const requested =
        input.shedId !== undefined
            ? input.shedId
            : current.role === "SHED"
              ? current.shedId
              : null;
    if (requested === null) {
        throw new ApiError(
            "SHED_REQUIRED",
            "A shed is required for the SHED role",
            400,
        );
    }
    return requested;
}

function auditActionFor(input: UpdateUserInput, wasActive: boolean) {
    if (input.isActive === false && wasActive) {
        return "USER_DISABLED";
    }
    if (input.isActive === true && !wasActive) {
        return "USER_ENABLED";
    }
    return "USER_UPDATED";
}

export async function updateUser(
    userId: number,
    input: UpdateUserInput,
    actorId: number,
) {
    if (input.isActive === false && userId === actorId) {
        throw new ApiError(
            "CANNOT_DISABLE_SELF",
            "You cannot disable your own account",
            409,
        );
    }
    const current = await getExistingUser(userId);
    const role = input.role ?? current.role;
    const shedId = nextShedId(current, input, role);
    if (shedId !== null && shedId !== current.shedId) {
        await assertShedExists(shedId);
    }
    const action = auditActionFor(input, current.isActive);
    return db.$transaction(async (tx) => {
        const updated = await tx.user.update({
            where: { id: userId },
            data: {
                ...(input.name !== undefined ? { name: input.name } : {}),
                role,
                shedId,
                ...(input.isActive !== undefined
                    ? { isActive: input.isActive }
                    : {}),
            },
            select: userSelect,
        });
        await writeAudit(tx, {
            userId: actorId,
            action,
            entity: "User",
            entityId: userId,
        });
        return updated;
    });
}

export async function resetPassword(
    userId: number,
    input: ResetPasswordInput,
    actorId: number,
) {
    await getExistingUser(userId);
    const passwordHash = await hashPassword(input.password);
    return db.$transaction(async (tx) => {
        const updated = await tx.user.update({
            where: { id: userId },
            data: { passwordHash },
            select: userSelect,
        });
        await writeAudit(tx, {
            userId: actorId,
            action: "USER_PASSWORD_RESET",
            entity: "User",
            entityId: userId,
        });
        return updated;
    });
}
