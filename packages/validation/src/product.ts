import { z } from "zod";
import { idSchema } from "./common.js";

export const createProductSchema = z.object({
  categoryId: idSchema,
  name: z.string().trim().min(2).max(120),
  productType: z
    .enum(["PHYSICAL", "MADE_TO_ORDER", "SERVICE"])
    .default("PHYSICAL"),
  description: z.string().trim().max(1000).optional(),
  price: z
    .string()
    .regex(
      /^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/,
      "Use a decimal amount with up to two decimal places",
    )
    .refine((value) => Number(value) > 0, "Price must be positive"),
  imageUrl: z.string().url().optional().or(z.literal("")),
  isAvailable: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const updateProductSchema = createProductSchema.partial();
