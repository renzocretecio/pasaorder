import { z } from "zod";
import { idSchema } from "./common.js";

export const createOrderSchema = z
  .object({
    storeSlug: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    idempotencyKey: z.string().uuid(),
    customerName: z.string().trim().min(2).max(120),
    customerPhone: z
      .string()
      .trim()
      .min(6)
      .max(40)
      .regex(/^[+()\d\s.-]+$/)
      .optional(),
    orderType: z.enum(["DINE_IN", "PICKUP", "DELIVERY"]),
    tableNumber: z.string().trim().max(40).optional(),
    deliveryAddress: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(
        z.object({
          productId: idSchema,
          variantId: idSchema.nullable(),
          quantity: z.number().int().positive().max(100),
          specialInstructions: z.string().trim().max(500).optional(),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((order, context) => {
    if (order.orderType !== "DINE_IN" && !order.customerPhone?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["customerPhone"],
        message: "Enter a mobile number",
      });
    }
    if (order.orderType !== "DINE_IN" && order.tableNumber?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["tableNumber"],
        message: "A table number is only available for dine-in orders",
      });
    }
    if (order.orderType === "DELIVERY" && !order.deliveryAddress?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Enter a delivery address",
      });
    }
  });

export const updateOrderStatusSchema = z
  .object({
    status: z.enum([
      "NEW",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "COMPLETED",
      "CANCELLED",
    ]),
    deliveryFee: z
      .string()
      .regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
      .optional(),
  })
  .strict();
