import { z } from "zod";

export const createVisitSchema = z.object({
    vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
    driverName: z.string().trim().min(1, "Driver name is required"),
    party: z.string().trim().min(1, "Party is required"),
    lines: z
        .array(
            z.object({
                itemId: z.coerce.number().int().positive("Pick an item"),
                qty: z.coerce.number().int().min(1, "Qty must be at least 1"),
            }),
        )
        .min(1, "Add at least one line"),
});

export type CreateVisitFormInput = z.infer<typeof createVisitSchema>;
