import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z
    .string()
    .min(8)
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z
    .string()
    .min(8)
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      "Password must be at most 72 UTF-8 bytes",
    ),
});
