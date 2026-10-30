import { z } from "zod";

export const loginSchema = z.object({
    username: z.string().min(1, "username is required").max(120),
    password: z.string().min(1, "password is required").max(256),
});

export type LoginInput = z.infer<typeof loginSchema>;
