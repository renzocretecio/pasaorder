import "dotenv/config";
import { z } from "zod";
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) => /^postgres(ql)?:/.test(value), "Use a PostgreSQL URL"),
  JWT_SECRET: z
    .string()
    .min(32)
    .refine(
      (value) =>
        value !== "replace-with-a-random-secret-at-least-32-characters",
      "Generate a real secret with pnpm env:setup",
    ),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  OCI_NAMESPACE: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  OCI_REGION: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  OCI_BUCKET_NAME: z.string().min(1).optional(),
  OCI_ACCESS_KEY_ID: z.string().min(1).optional(),
  OCI_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  OCI_IMAGE_PREFIX: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(32)
    .optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Only show field names and validation messages; never print environment values.
  throw new Error(
    `Invalid API configuration: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
  );
}
export const env = parsed.data;
