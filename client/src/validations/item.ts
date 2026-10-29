import { z } from "zod";

export const createItemSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    category: z.string().trim().min(1, "Category is required"),
    unit: z.string().trim().min(1, "Unit is required"),
    shedId: z.coerce.number().int().positive("Pick a shed"),
    currentStock: z.coerce.number().int().min(0).default(0),
    reorderLevel: z.coerce.number().int().min(0).default(0),
});

export type CreateItemFormInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = z.object({
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    reorderLevel: z.coerce.number().int().min(0).optional(),
    isActive: z.coerce.boolean().optional(),
});

export type UpdateItemFormInput = z.infer<typeof updateItemSchema>;

export const stockInSchema = z.object({
    qty: z.coerce.number().int().positive("Qty must be greater than 0"),
    reason: z.string().trim().max(255).optional(),
});

export type StockInFormInput = z.infer<typeof stockInSchema>;

export const adjustStockSchema = z.object({
    qty: z.coerce.number().int(),
    reason: z.string().trim().min(1, "Reason is required").max(255),
});

export type AdjustStockFormInput = z.infer<typeof adjustStockSchema>;
