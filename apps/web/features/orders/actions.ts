"use server";

import { revalidatePath } from "next/cache";
import {
  createManualOrderSchema,
  idSchema,
  updateOrderStatusSchema,
  updatePaymentStatusSchema,
} from "@pasaorder/validation";
import { ApiError, requireUser } from "@/lib/auth";
import { ownerApi } from "@/lib/catalog";
import type { Catalog, PastOrdersPage } from "@pasaorder/types";

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

export async function saveOwnerPushSubscription(value: unknown) {
  await requireUser();
  if (!value || typeof value !== "object")
    return {
      success: false,
      message: "Invalid device notification subscription.",
    };
  const subscription = value as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  };
  try {
    if (
      typeof subscription.endpoint !== "string" ||
      subscription.endpoint.length > 2048 ||
      new URL(subscription.endpoint).protocol !== "https:" ||
      typeof subscription.keys?.p256dh !== "string" ||
      typeof subscription.keys?.auth !== "string" ||
      subscription.keys.p256dh.length > 256 ||
      subscription.keys.auth.length > 256
    )
      throw new Error("invalid");
  } catch {
    return {
      success: false,
      message: "Invalid device notification subscription.",
    };
  }
  try {
    await ownerApi("/notifications/owner/subscription", {
      method: "POST",
      body: JSON.stringify(subscription),
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Could not enable order alerts. Please try again.",
    };
  }
}

export async function removeOwnerPushSubscription(endpoint: string) {
  await requireUser();
  try {
    if (endpoint.length > 2048 || new URL(endpoint).protocol !== "https:")
      throw new Error("invalid");
  } catch {
    return { success: false, message: "Invalid device notification endpoint." };
  }
  try {
    await ownerApi("/notifications/owner/subscription", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Could not turn off order alerts. Please try again.",
    };
  }
}

export async function getOwnerPushSubscription(endpoint: string) {
  await requireUser();
  try {
    if (endpoint.length > 2048 || new URL(endpoint).protocol !== "https:")
      throw new Error("invalid");
  } catch {
    return { success: false as const, enabled: false };
  }
  try {
    const result = await ownerApi<{ enabled: boolean }>(
      `/notifications/owner/subscription?endpoint=${encodeURIComponent(endpoint)}`,
    );
    return { success: true as const, enabled: result.enabled };
  } catch {
    return { success: false as const, enabled: false };
  }
}

export async function createManualOrder(storeId: string, value: unknown) {
  if (!idSchema.safeParse(storeId).success)
    return {
      success: false as const,
      reviewable: true,
      message: "Invalid store.",
    };
  const parsed = createManualOrderSchema.safeParse(value);
  if (!parsed.success)
    return {
      success: false as const,
      reviewable: true,
      message: "Check the order details and try again.",
    };
  try {
    await requireUser();
    const result = await ownerApi<{ order: { id: string } }>(
      `/orders/stores/${storeId}/manual`,
      { method: "POST", body: JSON.stringify(parsed.data) },
    );
    return { success: true as const, orderId: result.order.id };
  } catch (error) {
    return {
      success: false as const,
      reviewable:
        error instanceof ApiError && [400, 409, 422].includes(error.status),
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t save this order. Please try again.",
    };
  }
}

export async function loadManualOrderCatalog(storeId: string) {
  if (!idSchema.safeParse(storeId).success)
    return { success: false as const, message: "Invalid store." };
  try {
    await requireUser();
    const catalog = await ownerApi<Catalog>(`/catalog/stores/${storeId}`);
    return { success: true as const, catalog };
  } catch {
    return {
      success: false as const,
      message:
        "Couldn’t refresh the catalog. Reconnect or sign in, then try again.",
    };
  }
}
