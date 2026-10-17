"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { io } from "socket.io-client";
import { Dialog } from "radix-ui";
import { Check, ChevronDown, LoaderCircle, RefreshCw, X } from "lucide-react";
import type {
  BusinessCategory,
  OrderStatus,
  OrderWorkflow,
  OwnerOrder,
  PastOrdersPage,
} from "@pasaorder/types";
import type { Catalog } from "@pasaorder/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { peso } from "@/features/catalog/color";
import { orderTypeLabel } from "@/features/catalog/order-type-label";
import { quantityLabel } from "@/features/catalog/quantity";
import {
  loadPastOrdersPage,
  updateOrderPayment,
  updateOrderStatus,
} from "./actions";
import { ManualOrderCreate } from "./manual-order-create";

type Queue = "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "HISTORY";
type PaymentFilter = "ALL" | "UNPAID";

const queues: { id: Queue; label: string }[] = [
  { id: "NEW", label: "New" },
  { id: "CONFIRMED", label: "Confirmed" },
  { id: "PREPARING", label: "Preparing" },
  { id: "READY", label: "Ready" },
  { id: "HISTORY", label: "Past orders" },
];

const defaultStatusLabel: Record<OrderStatus, string> = {
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

const sourceLabel: Record<OwnerOrder["source"], string> = {
  MENU: "QR menu",
  MANUAL: "Manual",
  MESSENGER: "Messenger",
  INSTAGRAM: "Instagram",
  WEB_CHAT: "Web chat",
};

function nextQueueAction(queue: Queue, labels: OrderWorkflow["labels"]) {
  if (queue === "NEW") return `Next: ${labels.CONFIRMED.toLowerCase()}`;
  if (queue === "CONFIRMED") return `Next: ${labels.PREPARING.toLowerCase()}`;
  if (queue === "PREPARING") return `Next: ${labels.READY.toLowerCase()}`;
  if (queue === "READY") return `Next: ${labels.COMPLETED.toLowerCase()}`;
  return undefined;
}

function nextAction(status: OrderStatus, labels: OrderWorkflow["labels"]) {
  if (status === "NEW")
    return { status: "CONFIRMED" as const, label: "Confirm order" };
  if (status === "CONFIRMED")
    return {
      status: "PREPARING" as const,
      label: `Start ${labels.PREPARING.toLowerCase()}`,
    };
  if (status === "PREPARING")
    return {
      status: "READY" as const,
      label: `Mark ${labels.READY.toLowerCase()}`,
    };
  if (status === "READY")
    return {
      status: "COMPLETED" as const,
      label: `Mark ${labels.COMPLETED.toLowerCase()}`,
    };
  return null;
}

function formatPlacedAt(value: string) {
  const date = new Date(value);
  return date.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function formatScheduledFor(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function cents(value: number) {
  return Math.round(value * 100);
}

function PaymentProofDialog({
  orderId,
  uploadedAt,
}: {
  orderId: string;
  uploadedAt: string;
}) {
  const imageUrl = `/api/orders/${encodeURIComponent(orderId)}/payment-proof`;
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full rounded-lg"
        >
          View payment proof
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t-2xl border bg-card shadow-xl sm:inset-x-6 sm:top-1/2 sm:bottom-auto sm:mx-auto sm:max-h-[min(52rem,calc(100dvh-2rem))] sm:max-w-4xl sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold tracking-[-0.02em]">
                Payment proof · Order #{orderId}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Submitted {formatPlacedAt(uploadedAt)}. Review the transfer and
                mark the order paid when you have verified it.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close payment proof"
                className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3 sm:p-5">
            <div className="grid min-h-64 place-items-center overflow-hidden rounded-xl border bg-background p-2 sm:min-h-96 sm:p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated same-origin route streams the private proof image. */}
              <img
                src={imageUrl}
                alt={`GCash payment proof submitted for order ${orderId}`}
                className="max-h-[65dvh] max-w-full rounded-md object-contain"
              />
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OrderRow({
  order,
  businessCategory,
  workflow,
  nextActionLabel,
  initialOpen,
  onSuccess,
}: {
  order: OwnerOrder;
  businessCategory: BusinessCategory;
  workflow: OrderWorkflow;
  nextActionLabel?: string;
  initialOpen?: boolean;
  onSuccess: (message: string) => void;
}) {
  const [deliveryFee, setDeliveryFee] = useState("");
  const [message, setMessage] = useState("");
  const [retryStatus, setRetryStatus] = useState<OrderStatus | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(Boolean(initialOpen));
  const [openForFee, setOpenForFee] = useState(false);
  const feeInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [paymentPending, startPaymentTransition] = useTransition();
  const [paymentMessage, setPaymentMessage] = useState("");
  const router = useRouter();
  const labels = workflow.labels ?? defaultStatusLabel;
  const action = nextAction(order.status, labels);
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
        setDialogOpen(false);
        onSuccess(
          `Order #${order.id} ${status === "CANCELLED" ? "cancelled" : `moved to ${labels[status].toLowerCase()}`}.`,
        );
        router.refresh();
      } else {
        setMessage(result.message);
        setRetryStatus(status);
        if (order.status === "NEW") setDialogOpen(true);
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

  const orderDetails = (
    <div className="mt-4 grid gap-x-6 gap-y-4 md:grid-cols-[minmax(0,3fr)_minmax(15rem,2fr)]">
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
        {order.scheduledFor && (
          <p className="mt-2 text-sm font-medium text-primary">
            Requested for {formatScheduledFor(order.scheduledFor)} Philippine
            time
          </p>
        )}

        <details className="group mt-3" open={order.status === "NEW"}>
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-2 text-sm font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden">
            <span>
              <span className="group-open:hidden">
                {order.status === "NEW" ? "Items" : "Review"}{" "}
                {order.items.length}{" "}
                {order.items.length === 1 ? "item" : "items"}
                {order.status !== "NEW" &&
                (order.notes ||
                  order.formAnswers?.length ||
                  order.attachments.length ||
                  order.items.some((item) => item.specialInstructions))
                  ? " and notes"
                  : ""}
              </span>
              <span className="hidden group-open:inline">
                {order.status === "NEW"
                  ? `Items · ${order.items.length}`
                  : "Hide order details"}
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
                    {quantityLabel(item.quantity, item.quantityUnit)} ×
                  </span>{" "}
                  {item.productName}
                  {item.optionLabel ? ` · ${item.optionLabel}` : ""}
                  {item.productType !== "PHYSICAL" && (
                    <span className="ml-2 inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-primary">
                      {item.productType === "MADE_TO_ORDER"
                        ? "Made to order"
                        : "Service"}
                    </span>
                  )}
                  {item.addOns.length > 0 && (
                    <span className="mt-0.5 block pl-5 text-[13px] text-muted-foreground">
                      Options:{" "}
                      {item.addOns.map((addon) => addon.optionName).join(", ")}
                    </span>
                  )}
                  {item.productAnswers.length > 0 && (
                    <span className="mt-0.5 block pl-5 text-[13px] text-muted-foreground">
                      {item.productAnswers.map((answer) => (
                        <span
                          key={answer.questionId}
                          className="block break-words"
                        >
                          {answer.label}:{" "}
                          {answer.value === "true"
                            ? "Yes"
                            : answer.value === "false"
                              ? "No"
                              : answer.value}
                        </span>
                      ))}
                    </span>
                  )}
                  {order.attachments
                    .filter((attachment) => attachment.orderItemId === item.id)
                    .map((attachment) => (
                      <a
                        key={attachment.id}
                        href={`/api/orders/${order.id}/attachments/${attachment.id}`}
                        className="mt-1 block break-all pl-5 text-[13px] font-medium text-primary underline underline-offset-2"
                      >
                        {attachment.questionLabel}: {attachment.fileName}
                      </a>
                    ))}
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
          {order.formAnswers?.map((answer) => (
            <p
              key={answer.questionId}
              className="break-words pb-2 text-sm text-muted-foreground"
            >
              {answer.label}: {answer.value}
            </p>
          ))}
          {order.attachments
            .filter((attachment) => attachment.orderItemId === null)
            .map((attachment) => (
              <a
                key={attachment.id}
                href={`/api/orders/${order.id}/attachments/${attachment.id}`}
                className="block break-all pb-2 text-sm font-medium text-primary underline underline-offset-2"
              >
                {attachment.questionLabel}: {attachment.fileName}
              </a>
            ))}
        </details>
      </div>

      <div className="flex min-w-0 flex-col justify-end gap-3 border-t border-border pt-3 md:border-t-0 md:pt-0">
        {order.paymentProof && (
          <PaymentProofDialog
            orderId={order.id}
            uploadedAt={order.paymentProof.createdAt}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {order.paymentMethod === "GCASH" ? "GCash" : "Cash"}
            </p>
            <p className="text-xs text-muted-foreground">
              {order.paymentStatus === "PAID"
                ? "Paid"
                : order.paymentProof
                  ? "Proof received · review before confirming"
                  : "Payment not verified"}
            </p>
          </div>
          <Button
            type="button"
            variant={order.paymentStatus === "PAID" ? "outline" : "secondary"}
            size="sm"
            disabled={paymentPending || deliveryPaymentWaitingForFee}
            onClick={() =>
              updatePayment(order.paymentStatus === "PAID" ? "UNPAID" : "PAID")
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
                    ref={feeInputRef}
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
                <p className="text-sm font-medium">Cancel order #{order.id}?</p>
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
                    isPending || (isDeliveryConfirmation && deliveryFee === "")
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
              ? `Order ${labels.COMPLETED.toLowerCase()}`
              : "Order cancelled"}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <article
      id={`order-${order.id}`}
      className="scroll-mt-28 rounded-xl border border-border bg-card px-4 py-4 transition-colors hover:border-primary/25 sm:px-5 sm:py-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
            <h2 className="text-base font-semibold tracking-[-0.01em]">
              Order #{order.id}
            </h2>
            <Badge variant="outline" className={statusStyle[order.status]}>
              {labels[order.status]}
            </Badge>
            {nextActionLabel && (
              <span className="text-[13px] font-medium text-primary">
                {nextActionLabel}
              </span>
            )}
          </div>
          <p className="mt-2 break-words text-sm font-medium">
            {order.customerName}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {sourceLabel[order.source]}
            <span className="mx-1" aria-hidden="true">
              ·
            </span>
            {orderTypeLabel(order.orderType, businessCategory)}
            {order.orderType === "DINE_IN" && order.tableNumber && (
              <>
                <span className="mx-1" aria-hidden="true">
                  ·
                </span>
                Table {order.tableNumber}
              </>
            )}
            <span className="mx-1" aria-hidden="true">
              ·
            </span>
            {formatPlacedAt(order.createdAt)}
          </p>
        </div>
        <p className="shrink-0 text-lg font-semibold tracking-[-0.02em] tabular-nums">
          {peso(order.total)}
        </p>
      </div>

      {order.status === "NEW" ? (
        <Dialog.Root
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setConfirmCancel(false);
              setMessage("");
              setRetryStatus(null);
              setOpenForFee(false);
            }
          }}
        >
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="min-w-0 text-[13px] text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">
                  {order.items.length}{" "}
                  {order.items.length === 1 ? "item" : "items"}
                </span>
                <span aria-hidden="true"> · </span>
                {order.paymentMethod === "GCASH" ? "GCash" : "Cash"}
                {isDeliveryConfirmation && (
                  <>
                    <span aria-hidden="true"> · </span>
                    Delivery fee to set
                  </>
                )}
              </p>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Dialog.Trigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenForFee(false)}
                  className="min-h-11 flex-1 rounded-xl sm:flex-none"
                >
                  View order
                </Button>
              </Dialog.Trigger>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (isDeliveryConfirmation) {
                    setOpenForFee(true);
                    setDialogOpen(true);
                  } else {
                    update("CONFIRMED");
                  }
                }}
                className="min-h-11 flex-1 rounded-xl sm:flex-none"
              >
                {isPending && (
                  <LoaderCircle
                    className="size-4 animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isPending ? "Confirming…" : "Confirm order"}
              </Button>
            </div>
          </div>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
            <Dialog.Content
              onOpenAutoFocus={(event) => {
                if (openForFee && isDeliveryConfirmation) {
                  event.preventDefault();
                  feeInputRef.current?.focus();
                }
              }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden rounded-t-2xl border bg-card shadow-xl sm:inset-x-6 sm:top-1/2 sm:bottom-auto sm:mx-auto sm:max-h-[min(46rem,calc(100dvh-2rem))] sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-2xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <Dialog.Title className="text-lg font-semibold tracking-[-0.02em]">
                    Order #{order.id}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                    Review the customer’s order before confirming it.
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    aria-label="Close order details"
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <X className="size-5" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <div className="min-h-0 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
                {orderDetails}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      ) : (
        orderDetails
      )}
    </article>
  );
}

function PaymentFilterBar({
  value,
  total,
  unpaid,
  disabled = false,
  onChange,
}: {
  value: PaymentFilter;
  total: number;
  unpaid: number;
  disabled?: boolean;
  onChange: (value: PaymentFilter) => void;
}) {
  return (
    <div className="mb-4 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-[13px] font-medium text-muted-foreground">
        Payment
      </span>
      <div
        role="group"
        aria-label="Filter orders by payment status"
        className="flex flex-wrap gap-1"
      >
        {(
          [
            { id: "ALL", label: "All payments", count: total },
            { id: "UNPAID", label: "Unpaid", count: unpaid },
          ] as const
        ).map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={value === filter.id}
            disabled={disabled}
            onClick={() => onChange(filter.id)}
            className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${value === filter.id ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {filter.label}
            <span className="text-xs tabular-nums opacity-75">
              {filter.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HistoryQueue({
  storeId,
  businessCategory,
  workflow,
  initialPage,
  onSuccess,
}: {
  storeId: string;
  businessCategory: BusinessCategory;
  workflow: OrderWorkflow;
  initialPage: PastOrdersPage;
  onSuccess: (message: string) => void;
}) {
  const [payment, setPayment] = useState<PaymentFilter>("ALL");
  const [page, setPage] = useState(initialPage);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function load(nextPayment: PaymentFilter, cursor: string | null) {
    setError("");
    startTransition(async () => {
      const result = await loadPastOrdersPage(storeId, cursor, nextPayment);
      if (!result.success) {
        setError(result.message);
        if (!cursor) setPayment("ALL");
        return;
      }
      setPage((current) => ({
        ...result.page,
        orders: cursor
          ? [
              ...current.orders,
              ...result.page.orders.filter(
                (order) =>
                  !current.orders.some((existing) => existing.id === order.id),
              ),
            ]
          : result.page.orders,
      }));
      onSuccess(cursor ? "More past orders loaded." : "Past orders filtered.");
    });
  }

  return (
    <>
      <PaymentFilterBar
        value={payment}
        total={initialPage.totalCount}
        unpaid={initialPage.unpaidCount}
        disabled={pending}
        onChange={(filter) => {
          if (filter === payment) return;
          setPayment(filter);
          if (filter === "ALL") {
            setPage(initialPage);
            setError("");
            onSuccess("Showing all past orders.");
          } else load(filter, null);
        }}
      />
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {page.orders.length ? (
        <div className="space-y-3 sm:space-y-4">
          {page.orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              businessCategory={businessCategory}
              workflow={workflow}
              onSuccess={onSuccess}
            />
          ))}
        </div>
      ) : (
        <div className="border-t border-border py-10">
          <h2 className="text-base font-semibold">
            {pending
              ? "Loading past orders…"
              : payment === "UNPAID"
                ? "No unpaid past orders"
                : "No past orders yet"}
          </h2>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            Completed and cancelled orders will appear here.
          </p>
        </div>
      )}
      {page.nextCursor && (
        <div className="mt-5 flex justify-center">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 rounded-xl"
            disabled={pending}
            onClick={() => load(payment, page.nextCursor)}
          >
            {pending && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            {pending ? "Loading…" : "Load older orders"}
          </Button>
        </div>
      )}
    </>
  );
}

export function OrdersBoard({
  orders,
  initialHistoryPage,
  loadedAt,
  storeId,
  catalog,
  initialQueue,
  initialOrderId,
}: {
  orders: OwnerOrder[];
  initialHistoryPage: PastOrdersPage;
  loadedAt: string;
  storeId: string;
  catalog: Catalog;
  initialQueue?: string;
  initialOrderId?: string;
}) {
  const [queue, setQueue] = useState<Queue>(
    queues.some((item) => item.id === initialQueue)
      ? (initialQueue as Queue)
      : "NEW",
  );
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [announcement, setAnnouncement] = useState("");
  const [liveStatus, setLiveStatus] = useState<
    "connecting" | "live" | "reconnecting"
  >("connecting");
  const [refreshPending, startRefresh] = useTransition();
  const previousLoadedAt = useRef(loadedAt);
  const router = useRouter();
  const workflow = catalog.store.orderWorkflow;
  const labels = workflow.labels ?? defaultStatusLabel;
  const displayedQueues = queues.map((item) => ({
    ...item,
    label: item.id === "HISTORY" ? item.label : labels[item.id],
  }));

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

  const queueOrders = useMemo(
    () =>
      orders.filter((order) => {
        return order.status === queue;
      }),
    [orders, queue],
  );
  const unpaidCount = useMemo(
    () =>
      queueOrders.filter((order) => order.paymentStatus === "UNPAID").length,
    [queueOrders],
  );
  const visibleOrders = useMemo(
    () =>
      paymentFilter === "UNPAID"
        ? queueOrders.filter((order) => order.paymentStatus === "UNPAID")
        : queueOrders,
    [paymentFilter, queueOrders],
  );
  const counts = useMemo(
    () =>
      orders.reduce<Record<Queue, number>>(
        (result, order) => {
          if (order.status !== "COMPLETED" && order.status !== "CANCELLED")
            result[order.status] += 1;
          return result;
        },
        {
          NEW: 0,
          CONFIRMED: 0,
          PREPARING: 0,
          READY: 0,
          HISTORY: initialHistoryPage.totalCount,
        },
      ),
    [orders, initialHistoryPage.totalCount],
  );

  return (
    <section aria-label="Order queue">
      <ManualOrderCreate key={storeId} catalog={catalog} />
      <div className="flex flex-col gap-3 border-b border-border pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div
          className="-mx-1 flex min-w-0 max-w-full gap-1 overflow-x-auto px-1"
          role="group"
          aria-label="Filter orders by status"
        >
          {displayedQueues.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={queue === item.id}
              onClick={() => setQueue(item.id)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${queue === item.id ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {item.id === "HISTORY" ? item.label : labels[item.id]}
              <span className="text-xs tabular-nums opacity-75">
                {counts[item.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
          <span className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
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
              timeZone: "Asia/Manila",
            })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={refreshPending}
            onClick={() => startRefresh(() => router.refresh())}
            className="min-h-11 shrink-0 gap-2 rounded-xl"
          >
            <RefreshCw
              className={`size-4 ${refreshPending ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">
              {refreshPending ? "Refreshing…" : "Refresh orders"}
            </span>
            <span className="sr-only sm:hidden">
              {refreshPending ? "Refreshing orders" : "Refresh orders"}
            </span>
          </Button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>

      {queue === "HISTORY" ? (
        <HistoryQueue
          key={loadedAt}
          storeId={storeId}
          businessCategory={catalog.store.businessCategory}
          workflow={workflow}
          initialPage={initialHistoryPage}
          onSuccess={setAnnouncement}
        />
      ) : (
        <>
          <PaymentFilterBar
            value={paymentFilter}
            total={queueOrders.length}
            unpaid={unpaidCount}
            onChange={(filter) => {
              setPaymentFilter(filter);
              setAnnouncement(
                filter === "ALL"
                  ? "Showing all payment statuses in this queue."
                  : `Showing ${unpaidCount} unpaid ${labels[queue].toLowerCase()} ${unpaidCount === 1 ? "order" : "orders"}.`,
              );
            }}
          />

          {visibleOrders.length ? (
            <div className="space-y-3 sm:space-y-4">
              {visibleOrders.map((order, index) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  businessCategory={catalog.store.businessCategory}
                  initialOpen={
                    order.status === "NEW" && order.id === initialOrderId
                  }
                  nextActionLabel={
                    index === 0 ? nextQueueAction(queue, labels) : undefined
                  }
                  workflow={workflow}
                  onSuccess={setAnnouncement}
                />
              ))}
            </div>
          ) : (
            <div className="border-t border-border py-10">
              <h2 className="text-base font-semibold">
                {paymentFilter === "UNPAID" && queueOrders.length > 0
                  ? "No unpaid orders"
                  : orders.length === 0
                    ? "No orders yet"
                    : `No ${labels[queue].toLowerCase()} orders`}
              </h2>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                {paymentFilter === "UNPAID" && queueOrders.length > 0
                  ? "All orders in this queue are marked paid."
                  : orders.length === 0
                    ? "Orders placed through your published menus will appear here."
                    : queue === "NEW"
                      ? "New orders will appear here when customers place them. Refresh to check for new orders."
                      : "There are no orders in this queue right now."}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
