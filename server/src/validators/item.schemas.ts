import { z } from "zod";

const booleanFlag = z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])], {
        error: "must be true, false, 1 or 0",
    })
    .transform((value) => value === true || value === "true" || value === "1");

export const createItemSchema = z.object({
    name: z.string().trim().min(1, "name is required").max(120),
    category: z.string().trim().min(1, "category is required").max(120),
    unit: z.string().trim().min(1, "unit is required").max(40),
    shedId: z.coerce.number().int().positive(),
    currentStock: z.coerce.number().int().min(0).max(1_000_000).default(0),
    reorderLevel: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
    name: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(120).optional(),
    reorderLevel: z.coerce.number().int().min(0).max(1_000_000).optional(),
    isActive: booleanFlag.optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const stockInSchema = z.object({
    qty: z.coerce.number().int().positive("qty must be > 0").max(1_000_000),
    reason: z.string().trim().max(255).optional(),
});

export type StockInInput = z.infer<typeof stockInSchema>;

export const adjustStockSchema = z.object({
    qty: z.coerce
        .number()
        .int()
        .min(-1_000_000)
        .max(1_000_000)
        .refine((qty) => qty !== 0, "qty must not be 0"),
    reason: z.string().trim().min(1, "reason is required").max(255),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const listItemsQuerySchema = z.object({
    shed: z.string().trim().min(1).optional(),
    includeInactive: booleanFlag.optional(),
});

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
