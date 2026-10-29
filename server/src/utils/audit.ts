import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export async function writeAudit(
    db: Db,
    input: {
        userId: number;
        action: string;
        entity: string;
        entityId: number | string;
    },
) {
    await db.auditEvent.create({
        data: {
            userId: input.userId,
            action: input.action,
            entity: input.entity,
            entityId: String(input.entityId),
        },
    });
}
