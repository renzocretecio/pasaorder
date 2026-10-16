import { z } from "zod";
import { idSchema } from "./common.js";

const createOrderBaseSchema = z
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
    scheduledFor: z.iso.datetime({ offset: true }).optional(),
    paymentMethod: z.enum(["CASH", "GCASH"]),
    tableNumber: z.string().trim().max(40).optional(),
    deliveryAddress: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(500).optional(),
    formAnswers: z
      .array(
        z
          .object({ questionId: z.uuid(), value: z.string().trim().max(1000) })
          .strict(),
      )
      .max(8)
      .optional(),
    items: z
      .array(
        z.object({
          productId: idSchema,
          variantId: idSchema.nullable(),
          quantity: z.number().int().positive().max(100),
          specialInstructions: z.string().trim().max(500).optional(),
          addOns: z
            .array(z.object({ groupId: z.uuid(), optionId: z.uuid() }).strict())
            .max(40)
            .optional(),
          productAnswers: z
            .array(
              z
                .object({
                  questionId: z.uuid(),
                  value: z.string().trim().max(1000),
                })
                .strict(),
            )
            .max(8)
            .optional(),
          expectedUnitPrice: z
            .string()
            .regex(/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/)
            .optional(),
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

const validateOrderFulfillment = (
  order: {
    orderType: "DINE_IN" | "PICKUP" | "DELIVERY";
    tableNumber?: string;
    deliveryAddress?: string;
    scheduledFor?: string;
  },
  context: z.RefinementCtx,
) => {
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
  if (order.scheduledFor) {
    if (order.orderType === "DINE_IN") {
      context.addIssue({
        code: "custom",
        path: ["scheduledFor"],
        message: "Scheduled orders are available for pickup or delivery",
      });
      return;
    }
    const scheduledTime = Date.parse(order.scheduledFor);
    const now = Date.now();
    if (scheduledTime < now + 15 * 60_000) {
      context.addIssue({
        code: "custom",
        path: ["scheduledFor"],
        message: "Choose a time at least 15 minutes from now",
      });
    } else if (scheduledTime > now + 90 * 24 * 60 * 60_000) {
      context.addIssue({
        code: "custom",
        path: ["scheduledFor"],
        message: "Choose a date within the next 90 days",
      });
    }
  }
};

export const createOrderSchema = createOrderBaseSchema.superRefine(
  validateOrderFulfillment,
);
export const createManualOrderSchema = createOrderBaseSchema
  .omit({ storeSlug: true, scheduledFor: true })
  .superRefine(validateOrderFulfillment);

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

export const updatePaymentStatusSchema = z
  .object({ status: z.enum(["UNPAID", "PAID"]) })
  .strict();

const overviewDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  }, "Enter a valid date");

export const overviewDateRangeSchema = z
  .object({
    from: overviewDateSchema,
    to: overviewDateSchema,
  })
  .refine((range) => range.from <= range.to, {
    message: "Start date must be on or before end date",
  });
