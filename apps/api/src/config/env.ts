import "dotenv/config";
import { z } from "zod";
export const envSchema = z
  .object({
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
    GOOGLE_CLIENT_ID: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    GOOGLE_CLIENT_SECRET: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1).optional(),
    ),
    GOOGLE_REDIRECT_URI: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().url().optional(),
    ),
    R2_ENDPOINT: z.url().startsWith("https://").optional(),
    R2_BUCKET_NAME: z.string().min(1).optional(),
    R2_PRIVATE_BUCKET_NAME: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    IMAGE_PREFIX: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(32)
      .optional(),
    VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    VAPID_SUBJECT: z.string().url().optional(),
  })
  .superRefine((values, context) => {
    const googleValues = [
      values.GOOGLE_CLIENT_ID,
      values.GOOGLE_CLIENT_SECRET,
      values.GOOGLE_REDIRECT_URI,
    ];
    if (googleValues.some(Boolean) && googleValues.some((value) => !value)) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_CLIENT_ID"],
        message:
          "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI together",
      });
    }
    if (
      values.NODE_ENV === "production" &&
      values.GOOGLE_REDIRECT_URI &&
      !values.GOOGLE_REDIRECT_URI.startsWith("https://")
    ) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_REDIRECT_URI"],
        message: "Use an HTTPS Google callback URL in production",
      });
    }
    const vapidValues = [
      values.VAPID_PUBLIC_KEY,
      values.VAPID_PRIVATE_KEY,
      values.VAPID_SUBJECT,
    ];
    if (vapidValues.some(Boolean) && vapidValues.some((value) => !value)) {
      context.addIssue({
        code: "custom",
        path: ["VAPID_PUBLIC_KEY"],
        message:
          "Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT together",
      });
    }
  });
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Only show field names and validation messages; never print environment values.
  throw new Error(
    `Invalid API configuration: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
  );
}
export const env = parsed.data;
