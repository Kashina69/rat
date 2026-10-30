import { z } from "zod";

export const createVisitSchema = z.object({
    vehicleNumber: z
        .string()
        .trim()
        .min(1, "vehicleNumber is required")
        .max(20),
    driverName: z.string().trim().min(1, "driverName is required").max(120),
    party: z.string().trim().min(1, "party is required").max(120),
    lines: z
        .array(
            z.object({
                itemId: z.coerce.number().int().positive(),
                qty: z.coerce.number().int().positive().max(1_000_000),
            }),
        )
        .min(1, "At least one line is required"),
});

export type CreateVisitInput = z.infer<typeof createVisitSchema>;

export const listVisitsQuerySchema = z.object({
    status: z.enum(["inside"]).optional(),
});

export type ListVisitsQuery = z.infer<typeof listVisitsQuerySchema>;

export const confirmLineSchema = z.object({
    loadedQty: z.coerce
        .number()
        .int()
        .min(1, "loadedQty must be >= 1")
        .max(1_000_000),
});

export type ConfirmLineInput = z.infer<typeof confirmLineSchema>;
