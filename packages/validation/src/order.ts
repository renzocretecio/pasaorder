import { z } from "zod";
import { idSchema } from "./common.js";

export const startCustomerChatSchema = z
  .object({
    customerName: z.string().trim().min(2).max(120),
  })
  .strict();
export const sendCustomerChatMessageSchema = z
  .object({
    messageId: z.uuid(),
    text: z.string().trim().min(1).max(1000),
  })
  .strict();
export const customerChatTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

const draftDataSchema = z
  .object({
    customerName: z.string().trim().max(120).optional(),
    customerPhone: z.string().trim().max(40).optional(),
    orderType: z.enum(["DINE_IN", "PICKUP", "DELIVERY"]).optional(),
    tableNumber: z.string().trim().max(40).optional(),
    deliveryAddress: z.string().trim().max(500).optional(),
    paymentMethod: z.enum(["CASH", "GCASH"]).optional(),
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
      .max(100)
      .optional(),
  })
  .strict();

export const createChatOrderDraftSchema = z
  .object({
    source: z.enum(["MESSENGER", "INSTAGRAM"]),
    conversationText: z.string().trim().min(5).max(15000),
  })
  .strict();

export const updateChatOrderDraftSchema = z
  .object({
    conversationText: z.string().trim().min(5).max(15000),
    draftData: draftDataSchema,
  })
  .strict();

export const confirmChatOrderDraftSchema = z
  .object({
    expectedConversationText: z.string().max(15000).optional(),
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
    paymentMethod: z.enum(["CASH", "GCASH"]),
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
  .superRefine((draft, context) => {
    if (draft.orderType === "DELIVERY" && !draft.deliveryAddress?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "Enter a delivery address",
      });
    }
    if (draft.orderType !== "DINE_IN" && draft.tableNumber?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["tableNumber"],
        message: "A table number is only available for dine-in orders",
      });
    }
  });

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
    paymentMethod: z.enum(["CASH", "GCASH"]),
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
};

export const createOrderSchema = createOrderBaseSchema.superRefine(
  validateOrderFulfillment,
);
export const createManualOrderSchema = createOrderBaseSchema
  .omit({ storeSlug: true })
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
