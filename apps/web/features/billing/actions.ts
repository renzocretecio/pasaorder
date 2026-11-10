"use server";

import { revalidatePath } from "next/cache";
import {
  idSchema,
  subscriptionPaymentRequestSchema,
  subscriptionPaymentReviewSchema,
} from "@pasaorder/validation";
import { ApiError, requireUser } from "@/lib/auth";
import { ownerApi } from "@/lib/catalog";

export type BillingActionState = {
  success?: boolean;
  message?: string;
};

export async function submitSubscriptionPayment(
  _previous: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  await requireUser();
  const parsed = subscriptionPaymentRequestSchema.safeParse({
    reference: formData.get("reference"),
  });
  if (!parsed.success)
    return {
      message: parsed.error.issues[0]?.message ?? "Check the reference number.",
    };
  try {
    await ownerApi("/billing/requests", {
      method: "POST",
      body: JSON.stringify(parsed.data),
    });
    revalidatePath("/dashboard/plan");
    return {
      success: true,
      message: "Payment submitted. Pro access starts after it’s reviewed.",
    };
  } catch (error) {
    return {
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t submit the payment. Try again shortly.",
    };
  }
}

export async function reviewSubscriptionPayment(
  _previous: BillingActionState,
  formData: FormData,
): Promise<BillingActionState> {
  await requireUser();
  const paymentId = idSchema.safeParse(String(formData.get("paymentId") ?? ""));
  const decision = subscriptionPaymentReviewSchema.safeParse({
    decision: formData.get("decision"),
    reason: formData.get("reason") || undefined,
  });
  if (!paymentId.success || !decision.success)
    return { message: "Check the payment review details and try again." };
  try {
    await ownerApi(`/billing/admin/requests/${paymentId.data}/review`, {
      method: "POST",
      body: JSON.stringify(decision.data),
    });
    revalidatePath("/dashboard/billing/review");
    revalidatePath("/dashboard/plan");
    return {
      success: true,
      message:
        decision.data.decision === "APPROVE"
          ? "Payment approved. Pro is active for one month."
          : "Payment rejected. The owner can submit another reference.",
    };
  } catch (error) {
    return {
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t review the payment. Try again shortly.",
    };
  }
}
