"use server";

import { revalidatePath } from "next/cache";
import {
  idSchema,
  updateOrderStatusSchema,
  updatePaymentStatusSchema,
} from "@pasaorder/validation";
import { ApiError, requireUser } from "@/lib/auth";
import { ownerApi } from "@/lib/catalog";
import type { PastOrdersPage } from "@pasaorder/types";

export async function loadPastOrdersPage(
  storeId: string,
  cursor: string | null,
  payment: "ALL" | "UNPAID",
) {
  await requireUser();
  if (
    !idSchema.safeParse(storeId).success ||
    (cursor !== null && (typeof cursor !== "string" || cursor.length > 256)) ||
    (payment !== "ALL" && payment !== "UNPAID")
  )
    return { success: false as const, message: "Invalid history request." };
  const params = new URLSearchParams({ payment });
  if (cursor) params.set("cursor", cursor);
  try {
    const page = await ownerApi<PastOrdersPage>(
      `/orders/stores/${storeId}/history?${params}`,
    );
    return { success: true as const, page };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t load past orders. Please try again.",
    };
  }
}

export async function updateOrderStatus(
  orderId: string,
  status: string,
  deliveryFee = "",
) {
  await requireUser();
  if (!idSchema.safeParse(orderId).success)
    return { success: false, message: "Invalid order. Reload and try again." };
  const parsed = updateOrderStatusSchema.safeParse({
    status,
    ...(deliveryFee !== "" ? { deliveryFee } : {}),
  });
  if (!parsed.success)
    return { success: false, message: "Enter a valid delivery fee." };
  try {
    await ownerApi(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    revalidatePath("/dashboard/orders");
    return { success: true, message: "Order updated." };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t update this order. Please try again.",
    };
  }
}

export async function updateOrderPayment(orderId: string, status: string) {
  await requireUser();
  if (!idSchema.safeParse(orderId).success)
    return { success: false, message: "Invalid order. Reload and try again." };
  const parsed = updatePaymentStatusSchema.safeParse({ status });
  if (!parsed.success)
    return { success: false, message: "Choose a valid payment status." };
  try {
    await ownerApi(`/orders/${orderId}/payment`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    revalidatePath("/dashboard/orders");
    return { success: true, message: "Payment status updated." };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t update payment status. Please try again.",
    };
  }
}
