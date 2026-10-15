import { createManualOrderSchema } from "@pasaorder/validation";

export type ManualPayload = ReturnType<typeof createManualOrderSchema.parse>;
export type SavedManualOrder = {
  id: string;
  payload: ManualPayload;
  savedAt: number;
  names: string[];
  state: "waiting" | "review" | "retry";
  error?: string;
};
export type SendResult =
  | { success: true; orderId: string }
  | { success: false; message: string; reviewable: boolean };

export const manualStorageKey = (storeId: string) =>
  `pasaorder:manual-orders:v1:${storeId}`;

export function captureManualOrder(
  payload: ManualPayload,
  names: string[],
  previous?: SavedManualOrder,
): SavedManualOrder {
  return {
    id: payload.idempotencyKey,
    payload,
    names,
    savedAt: previous?.savedAt ?? Date.now(),
    state: "waiting",
  };
}

export function restoreManualOrders(raw: string | null): SavedManualOrder[] {
  const values: unknown = JSON.parse(raw ?? "[]");
  if (!Array.isArray(values))
    throw new Error("Saved orders could not be read.");
  return values.map((value) => {
    const payload = createManualOrderSchema.parse(value.payload);
    if (value.id !== payload.idempotencyKey || !Number.isFinite(value.savedAt))
      throw new Error("Saved order is incomplete.");
    const missingPrice = payload.items.some(
      (item) => item.expectedUnitPrice === undefined,
    );
    return {
      id: value.id,
      payload,
      savedAt: value.savedAt,
      names:
        Array.isArray(value.names) &&
        value.names.every((name: unknown) => typeof name === "string")
          ? value.names
          : [],
      state:
        value.state === "review" || value.state === "retry"
          ? value.state
          : missingPrice
            ? "review"
            : "waiting",
      error:
        typeof value.error === "string"
          ? value.error
          : missingPrice
            ? "Review current prices before sending this saved order."
            : undefined,
    };
  });
}

export function manualSubtotal(payload: ManualPayload) {
  return payload.items.reduce(
    (sum, item) =>
      sum +
      Math.round(Number(item.expectedUnitPrice ?? 0) * 100) * item.quantity,
    0,
  );
}

// A single pass never retries a rejected entry and doesn't hold up later orders.
export async function syncManualOrderPass(
  entries: SavedManualOrder[],
  send: (payload: ManualPayload) => Promise<SendResult>,
  settle: (entry: SavedManualOrder, result: SendResult) => void,
  connected: () => boolean,
) {
  for (const entry of entries) {
    if (!connected()) break;
    if (entry.state !== "waiting") continue;
    let result: SendResult;
    try {
      result = await send(entry.payload);
    } catch {
      result = {
        success: false,
        reviewable: false,
        message:
          "We couldn’t confirm whether this order reached the store. Retry this saved order when connected; don’t enter it again.",
      };
    }
    settle(entry, result);
  }
}
