"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import {
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  RefreshCw,
  X,
} from "lucide-react";
import type { OrderStatus, OrderType, OwnerOrder } from "@pasaorder/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { peso } from "@/features/catalog/color";
import { updateOrderPayment, updateOrderStatus } from "./actions";

type Queue = "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "HISTORY";

const queues: { id: Queue; label: string }[] = [
  { id: "NEW", label: "New" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PREPARING", label: "Preparing" },
  { id: "READY", label: "Ready" },
  { id: "HISTORY", label: "Past orders" },
];

const nextQueueAction: Partial<Record<Queue, string>> = {
  NEW: "Next to review",
  CONFIRMED: "Next to prepare",
  PREPARING: "Next to mark ready",
  READY: "Next to complete",
};

const statusLabel: Record<OrderStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const statusStyle: Record<OrderStatus, string> = {
  NEW: "border-amber-200 bg-amber-50 text-amber-900",
  CONFIRMED: "border-[#d6dfd6] bg-[#eef2ea] text-[#244d35]",
  PREPARING: "border-amber-200 bg-amber-50 text-amber-900",
  READY: "border-emerald-200 bg-emerald-50 text-emerald-900",
  COMPLETED: "border-[#d6dfd6] bg-[#f1f3ef] text-[#59685d]",
  CANCELLED: "border-red-200 bg-red-50 text-red-800",
};

const orderTypeLabel: Record<OrderType, string> = {
  DINE_IN: "Dine in",
  PICKUP: "Takeaway",
  DELIVERY: "Delivery",
};

function nextAction(status: OrderStatus) {
  if (status === "NEW")
    return { status: "CONFIRMED" as const, label: "Confirm order" };
  if (status === "CONFIRMED")
    return { status: "PREPARING" as const, label: "Start preparing" };
  if (status === "PREPARING")
    return { status: "READY" as const, label: "Mark ready" };
  if (status === "READY")
    return { status: "COMPLETED" as const, label: "Complete order" };
  return null;
}

function formatPlacedAt(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cents(value: number) {
  return Math.round(value * 100);
}

function OrderRow({
  order,
  nextActionLabel,
  onSuccess,
}: {
  order: OwnerOrder;
  nextActionLabel?: string;
  onSuccess: (message: string) => void;
}) {
  const [deliveryFee, setDeliveryFee] = useState("");
  const [message, setMessage] = useState("");
  const [retryStatus, setRetryStatus] = useState<OrderStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [paymentPending, startPaymentTransition] = useTransition();
  const [paymentMessage, setPaymentMessage] = useState("");
  const router = useRouter();
  const action = nextAction(order.status);
  const deliveryPaymentWaitingForFee =
    order.paymentStatus === "UNPAID" &&
    order.orderType === "DELIVERY" &&
    order.deliveryFee === null;
  const isDeliveryConfirmation =
    order.status === "NEW" && order.orderType === "DELIVERY";
  const feeCents = deliveryFee === "" ? null : cents(Number(deliveryFee));
  const previewTotal =
    feeCents === null || !Number.isFinite(feeCents)
      ? null
      : cents(Number(order.subtotal)) + feeCents;

  function update(status: OrderStatus) {
    setMessage("");
    setRetryStatus(null);
    setConfirmCancel(false);
    startTransition(async () => {
      const result = await updateOrderStatus(
        order.id,
        status,
        status === "CONFIRMED" && isDeliveryConfirmation ? deliveryFee : "",
      );
      if (result.success) {
        onSuccess(
          `Order #${order.id} ${status === "CANCELLED" ? "cancelled" : status === "CONFIRMED" ? "confirmed" : `moved to ${statusLabel[status].toLowerCase()}`}.`,
        );
        router.refresh();
      } else {
        setMessage(result.message);
        setRetryStatus(status);
      }
    });
  }

  function updatePayment(status: "PAID" | "UNPAID") {
    setPaymentMessage("");
    startPaymentTransition(async () => {
      const result = await updateOrderPayment(order.id, status);
      if (result.success) {
        onSuccess(`Order #${order.id} payment marked ${status.toLowerCase()}.`);
        router.refresh();
      } else setPaymentMessage(result.message);
    });
  }

  return (
    <article className="rounded-2xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/25 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="text-base font-semibold tracking-[-0.01em]">
              Order #{order.id}
            </h2>
            <Badge variant="outline" className={statusStyle[order.status]}>
              {statusLabel[order.status]}
            </Badge>
            {nextActionLabel && (
              <Badge variant="secondary" className="font-medium">
                {nextActionLabel}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {order.storeName} <span aria-hidden="true">·</span>{" "}
            {orderTypeLabel[order.orderType]}
            {order.orderType === "DINE_IN" && order.tableNumber && (
              <>
                <span aria-hidden="true">·</span> Table {order.tableNumber}
              </>
            )}{" "}
            <span aria-hidden="true">·</span> {formatPlacedAt(order.createdAt)}
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold tracking-[-0.02em] tabular-nums">
          {peso(order.total)}
        </p>
      </div>

      <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.85fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="font-medium">{order.customerName}</p>
            {order.customerPhone && (
              <a
                href={`tel:${order.customerPhone}`}
                className="text-sm text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
              >
                {order.customerPhone}
              </a>
            )}
          </div>
          {order.orderType === "DELIVERY" && order.deliveryAddress && (
            <p className="mt-1 break-words text-sm text-muted-foreground">
              {order.deliveryAddress}
            </p>
          )}

          <details className="group mt-3" open={order.status === "NEW"}>
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
              <span>
                <span className="group-open:hidden">
                  Review {order.items.length}{" "}
                  {order.items.length === 1 ? "item" : "items"}
                  {order.notes ||
                  order.items.some((item) => item.specialInstructions)
                    ? " and notes"
                    : ""}
                </span>
                <span className="hidden group-open:inline">
                  Hide order details
                </span>
              </span>
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 transition-transform group-open:rotate-180"
              />
            </summary>
            <ul className="space-y-2 pb-2 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-4">
                  <span className="min-w-0 break-words">
                    <span className="font-medium tabular-nums">
                      {item.quantity} ×
                    </span>{" "}
                    {item.productName}
                    {item.optionLabel ? ` · ${item.optionLabel}` : ""}
                    {item.specialInstructions && (
                      <span className="mt-0.5 block pl-5 text-[13px] text-muted-foreground">
                        {item.specialInstructions}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {peso(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
            {order.notes && (
              <p className="break-words pb-2 text-sm text-muted-foreground">
                Note: {order.notes}
              </p>
            )}
          </details>
        </div>

        <div className="flex min-w-0 flex-col justify-end gap-3 border-t border-border pt-3 md:border-t-0 md:pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
            <div className="min-w-0 text-sm">
              <p className="font-medium">
                {order.paymentMethod === "GCASH" ? "GCash" : "Cash"}
              </p>
              <p className="text-xs text-muted-foreground">
                {order.paymentStatus === "PAID"
                  ? "Paid"
                  : "Payment not verified"}
              </p>
            </div>
            <Button
              type="button"
              variant={order.paymentStatus === "PAID" ? "outline" : "secondary"}
              size="sm"
              disabled={paymentPending || deliveryPaymentWaitingForFee}
              onClick={() =>
                updatePayment(
                  order.paymentStatus === "PAID" ? "UNPAID" : "PAID",
                )
              }
              className="min-h-10 rounded-lg"
            >
              {paymentPending
                ? "Updating…"
                : deliveryPaymentWaitingForFee
                  ? "Confirm fee first"
                  : order.paymentStatus === "PAID"
                    ? "Undo paid"
                    : "Mark as paid"}
            </Button>
          </div>
          {deliveryPaymentWaitingForFee && (
            <p className="text-xs text-muted-foreground">
              Confirm the delivery fee before marking this order paid.
            </p>
          )}
          {paymentMessage && (
            <p role="alert" className="text-sm text-destructive">
              {paymentMessage}
            </p>
          )}
          {order.orderType === "DELIVERY" && (
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="font-medium tabular-nums">
                {order.deliveryFee === null
                  ? "To be confirmed"
                  : peso(order.deliveryFee)}
              </span>
            </div>
          )}
          {action ? (
            <>
              {isDeliveryConfirmation && (
                <div>
                  <label
                    htmlFor={`delivery-fee-${order.id}`}
                    className="mb-1.5 block text-[13px] font-medium"
                  >
                    Delivery fee to confirm
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                      ₱
                    </span>
                    <input
                      id={`delivery-fee-${order.id}`}
                      type="number"
                      min="0"
                      max="99999999.99"
                      step="0.01"
                      inputMode="decimal"
                      value={deliveryFee}
                      onChange={(event) => setDeliveryFee(event.target.value)}
                      aria-describedby={`delivery-help-${order.id}`}
                      className="h-11 w-full rounded-xl border border-input bg-background pl-8 pr-3 text-base tabular-nums outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                  </div>
                  <p
                    id={`delivery-help-${order.id}`}
                    className="mt-1 text-xs text-muted-foreground"
                  >
                    Enter 0 if delivery is free. The fee is added to the
                    customer’s total.
                  </p>
                  {previewTotal !== null &&
                    feeCents !== null &&
                    feeCents >= 0 && (
                      <div className="mt-3 space-y-1 rounded-xl bg-secondary/70 px-3 py-2.5 text-sm">
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>Items</span>
                          <span className="tabular-nums">
                            {peso(order.subtotal)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 text-muted-foreground">
                          <span>Delivery</span>
                          <span className="tabular-nums">
                            {peso((feeCents / 100).toFixed(2))}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 border-t border-border pt-1.5 font-semibold text-foreground">
                          <span>Customer total</span>
                          <span className="tabular-nums">
                            {peso((previewTotal / 100).toFixed(2))}
                          </span>
                        </div>
                      </div>
                    )}
                </div>
              )}
              {message && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive"
                >
                  <span>{message}</span>
                  {retryStatus && (
                    <button
                      type="button"
                      onClick={() => update(retryStatus)}
                      className="min-h-11 font-medium underline underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      Try again
                    </button>
                  )}
                </div>
              )}
              {confirmCancel ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-medium">
                    Cancel order #{order.id}?
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This will remove it from the active queue.
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 rounded-xl"
                      onClick={() => setConfirmCancel(false)}
                      disabled={isPending}
                    >
                      Keep order
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="min-h-11 rounded-xl"
                      onClick={() => update("CANCELLED")}
                      disabled={isPending}
                    >
                      {isPending && (
                        <LoaderCircle
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      Cancel order
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setMessage("");
                      setConfirmCancel(true);
                    }}
                    disabled={isPending}
                    className="min-h-11 px-2 text-sm font-medium text-destructive underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                  >
                    Cancel order
                  </button>
                  <Button
                    type="button"
                    onClick={() => action && update(action.status)}
                    disabled={
                      isPending ||
                      (isDeliveryConfirmation && deliveryFee === "")
                    }
                    className="h-11 flex-1 rounded-xl sm:flex-none"
                  >
                    {isPending ? (
                      <LoaderCircle
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <Check className="size-4" aria-hidden="true" />
                    )}
                    {isPending ? "Updating…" : action.label}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              {order.status === "COMPLETED" ? (
                <Check className="size-4" aria-hidden="true" />
              ) : (
                <X className="size-4" aria-hidden="true" />
              )}
              {order.status === "COMPLETED"
                ? "Order complete"
                : "Order cancelled"}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

export function OrdersBoard({
  orders,
  loadedAt,
  storeId,
}: {
  orders: OwnerOrder[];
  loadedAt: string;
  storeId: string;
}) {
  const [queue, setQueue] = useState<Queue>("NEW");
  const [announcement, setAnnouncement] = useState("");
  const [liveStatus, setLiveStatus] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  const [refreshPending, startRefresh] = useTransition();
  const previousLoadedAt = useRef(loadedAt);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let liveConnected = false;
    const socketUrl =
      process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";
    const socket = io(socketUrl, {
      auth: (callback) => {
        fetch("/api/socket-token", { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok)
              throw new Error("Unable to authenticate live updates");
            return response.json() as Promise<{ token: string }>;
          })
          .then(({ token }) => callback({ token }))
          .catch(() => callback({ token: "" }));
      },
      autoConnect: false,
    });
    socket.on("connect", () => {
      socket.emit("store:join", { storeId }, ({ ok }: { ok: boolean }) => {
        if (!ok || !active) return;
        if (liveConnected) router.refresh();
        liveConnected = true;
        setLiveStatus("live");
        setAnnouncement("Live order updates connected.");
      });
    });
    socket.on("orders:changed", (event: { storeId?: string }) => {
      if (event.storeId === storeId) {
        setAnnouncement("An order changed. Refreshing the queue.");
        router.refresh();
      }
    });
    socket.on("disconnect", (reason) => {
      liveConnected = false;
      setLiveStatus("reconnecting");
      if (reason === "io server disconnect") {
        window.setTimeout(() => socket.connect(), 0);
      }
    });
    socket.on("connect_error", () => setLiveStatus("reconnecting"));
    socket.connect();
    return () => {
      active = false;
      socket.disconnect();
    };
  }, [router, storeId]);

  useEffect(() => {
    if (previousLoadedAt.current !== loadedAt) {
      previousLoadedAt.current = loadedAt;
      setAnnouncement("Orders refreshed.");
    }
  }, [loadedAt]);

  const visibleOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesQueue =
          queue === "HISTORY"
            ? order.status === "COMPLETED" || order.status === "CANCELLED"
            : order.status === queue;
        return matchesQueue;
      }),
    [orders, queue],
  );
  const counts = useMemo(
    () =>
      orders.reduce<Record<Queue, number>>(
        (result, order) => {
          if (order.status === "COMPLETED" || order.status === "CANCELLED")
            result.HISTORY += 1;
          else result[order.status] += 1;
          return result;
        },
        { NEW: 0, CONFIRMED: 0, PREPARING: 0, READY: 0, HISTORY: 0 },
      ),
    [orders],
  );

  return (
    <section aria-label="Order queue">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-2 sm:justify-start">
          <div
            className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1"
            role="group"
            aria-label="Filter orders by status"
          >
            {queues.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={queue === item.id}
                onClick={() => setQueue(item.id)}
                className={`flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${queue === item.id ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {item.label}
                <span
                  className={`tabular-nums ${queue === item.id ? "text-primary" : "text-muted-foreground"}`}
                >
                  {counts[item.id]}
                </span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshPending}
            onClick={() => startRefresh(() => router.refresh())}
            className="min-h-11 shrink-0 gap-2 rounded-xl sm:hidden"
          >
            <RefreshCw
              className={`size-4 ${refreshPending ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="sr-only">
              {refreshPending ? "Refreshing orders" : "Refresh orders"}
            </span>
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className={`size-2 rounded-full ${liveStatus === "live" ? "bg-emerald-500" : "bg-amber-500"}`}
            />
            {liveStatus === "live"
              ? "Live"
              : liveStatus === "connecting"
                ? "Connecting"
                : "Reconnecting"}
            <span aria-hidden="true">·</span>
            Updated{" "}
            {new Date(loadedAt).toLocaleTimeString("en-PH", {
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshPending}
            onClick={() => startRefresh(() => router.refresh())}
            className="hidden min-h-11 gap-2 rounded-xl sm:inline-flex"
          >
            <RefreshCw
              className={`size-4 ${refreshPending ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {refreshPending ? "Refreshing…" : "Refresh orders"}
          </Button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {visibleOrders.length ? (
        <div className="space-y-3 sm:space-y-4">
          {visibleOrders.map((order, index) => (
            <OrderRow
              key={order.id}
              order={order}
              nextActionLabel={index === 0 ? nextQueueAction[queue] : undefined}
              onSuccess={setAnnouncement}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center">
          <Clock3
            className="mx-auto size-6 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-base font-semibold">
            {orders.length === 0
              ? "No orders yet"
              : `No ${queues.find((item) => item.id === queue)?.label.toLowerCase()} orders`}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {orders.length === 0
              ? "Orders placed through your published menus will appear here."
              : queue === "NEW"
                ? "New orders will appear here when customers place them. Refresh to check for new orders."
                : "There are no orders in this queue right now."}
          </p>
        </div>
      )}
    </section>
  );
}
