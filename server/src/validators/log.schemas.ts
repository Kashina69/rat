import { z } from "zod";

const dateString = z
    .string()
    .trim()
    .min(1)
    .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "Invalid date",
    });

export const listLogsQuerySchema = z.object({
    vehicle: z.string().trim().min(1).optional(),
    item: z.coerce.number().int().positive().optional(),
    shed: z.string().trim().min(1).optional(),
    status: z.enum(["PENDING", "LOADED", "CANCELLED"]).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;

export const exportLogsQuerySchema = listLogsQuerySchema.omit({
    page: true,
    limit: true,
});

export type ExportLogsQuery = z.infer<typeof exportLogsQuerySchema>;
