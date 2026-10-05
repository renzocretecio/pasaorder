import { z } from "zod";
export const idSchema = z
  .string()
  .regex(/^[1-9]\d*$/, "Expected a positive integer ID string")
  .refine(
    (value) =>
      /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n,
    "ID exceeds PostgreSQL bigint range",
  );
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and single hyphens",
  );
