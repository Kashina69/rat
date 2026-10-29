import { z } from "zod";

export const createItemSchema = z.object({
    name: z.string().trim().min(1, "name is required"),
    category: z.string().trim().min(1, "category is required"),
    unit: z.string().trim().min(1, "unit is required"),
    shedId: z.coerce.number().int().positive(),
    currentStock: z.coerce.number().int().min(0).default(0),
    reorderLevel: z.coerce.number().int().min(0).default(0),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    reorderLevel: z.coerce.number().int().min(0).optional(),
    isActive: z.coerce.boolean().optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

export const stockInSchema = z.object({
    qty: z.coerce.number().int().positive("qty must be > 0"),
    reason: z.string().trim().max(255).optional(),
});

export type StockInInput = z.infer<typeof stockInSchema>;

export const adjustStockSchema = z.object({
    qty: z.coerce.number().int(),
    reason: z.string().trim().min(1, "reason is required").max(255),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;

export const listItemsQuerySchema = z.object({
    shed: z.string().trim().min(1).optional(),
    includeInactive: z.coerce.boolean().optional(),
});

export type ListItemsQuery = z.infer<typeof listItemsQuerySchema>;
