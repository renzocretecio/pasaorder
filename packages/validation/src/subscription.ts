import { z } from "zod";

export const subscriptionPaymentRequestSchema = z
  .object({
    reference: z
      .string()
      .trim()
      .min(6, "Enter the GCash reference number")
      .max(80)
      .regex(/^[A-Za-z0-9-]+$/, "Use the reference number shown in GCash"),
  })
  .strict();

export const subscriptionPaymentReviewSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => value.decision !== "REJECT" || Boolean(value.reason), {
    path: ["reason"],
    message: "Add a short reason for rejecting payment",
  });
