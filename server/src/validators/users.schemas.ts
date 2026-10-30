import { z } from "zod";

const roleSchema = z.enum(["ADMIN", "GATE", "SHED"]);

const nameSchema = z.string().trim().min(1, "name is required").max(120);
const usernameSchema = z
    .string()
    .trim()
    .min(3, "username must be at least 3 characters")
    .max(64, "username must be at most 64 characters");
const passwordSchema = z
    .string()
    .min(8, "password must be at least 8 characters")
    .max(72, "password must be at most 72 characters");
const shedIdSchema = z.coerce.number().int().positive();

export const createUserSchema = z
    .object({
        name: nameSchema,
        username: usernameSchema,
        password: passwordSchema,
        role: roleSchema,
        shedId: shedIdSchema.nullish(),
    })
    .refine(
        (value) =>
            value.role === "SHED"
                ? value.shedId !== null && value.shedId !== undefined
                : value.shedId === null || value.shedId === undefined,
        {
            message:
                "shedId is required for the SHED role and forbidden otherwise",
            path: ["shedId"],
        },
    );

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
    .object({
        name: nameSchema.optional(),
        role: roleSchema.optional(),
        shedId: shedIdSchema.nullable().optional(),
        isActive: z.boolean().optional(),
    })
    .refine(
        (value) =>
            value.shedId === null ||
            value.shedId === undefined ||
            value.role === undefined ||
            value.role === "SHED",
        {
            message: "shedId is only allowed for the SHED role",
            path: ["shedId"],
        },
    );

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
    password: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
