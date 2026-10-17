import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, authApi } from "@/lib/auth";
import { peso } from "@/features/catalog/color";
import type {
  PaymentInstructions,
  PaymentMethod,
  PaymentStatus,
  OrderWorkflow,
  StoreOrderAnswer,
  BusinessCategory,
  QuantityUnit,
} from "@pasaorder/types";
import { CopyPaymentDetails } from "@/features/catalog/copy-payment-details";
import { PaymentProofUpload } from "@/features/orders/payment-proof-upload";
import { CustomerReadyAlert } from "@/features/notifications/customer-ready-alert";
import { CustomerOrderLiveUpdates } from "@/features/orders/customer-order-live-updates";
import { orderTypeLabel } from "@/features/catalog/order-type-label";
import { quantityLabel } from "@/features/catalog/quantity";

export const metadata: Metadata = {
  title: "Order status | PasaOrder",
  robots: { index: false, follow: false, noarchive: true },
};

type TrackedOrder = {
  id: string;
  storeName: string;
  storeSlug: string;
  businessCategory: BusinessCategory;
  status:
    "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  orderType: "DINE_IN" | "PICKUP" | "DELIVERY";
  orderWorkflow: OrderWorkflow;
  tableNumber: string | null;
  itemsSubtotal: string;
  total: string;
  deliveryFee: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentInstructions: PaymentInstructions | null;
  paymentProof: { uploadedAt: string } | null;
  formAnswers: StoreOrderAnswer[];
  createdAt: string;
  scheduledFor: string | null;
  items: {
    productName: string;
    productType: "PHYSICAL" | "MADE_TO_ORDER" | "SERVICE";
    optionLabel: string | null;
    quantityUnit: QuantityUnit;
    productAnswers: StoreOrderAnswer[];
    addOns: { groupName: string; optionName: string; price: string }[];
    quantity: number;
    unitPrice: string;
    subtotal: string;
  }[];
};

const defaultStatusLabels: Record<TrackedOrder["status"], string> = {
  NEW: "Waiting for store review",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export default async function OrderTrackingPage({
  params,
}: {
  params: Promise<{ trackingToken: string }>;
}) {
  const { trackingToken } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(trackingToken)) notFound();
  let order: TrackedOrder;
  try {
    ({ order } = await authApi<{ order: TrackedOrder }>(
      `/public/orders/${trackingToken}`,
    ));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const statusLabels = order.orderWorkflow?.labels ?? defaultStatusLabels;

  return (
    <main className="min-h-dvh bg-[#f6f5ef] px-4 py-8 text-[#18251d] sm:py-14">
      <div className="mx-auto max-w-xl">
        <Link
          href={`/menu/${order.storeSlug}`}
          className="text-sm font-medium text-[#244d35] underline underline-offset-4"
        >
          {order.storeName}
        </Link>
        <div className="mt-6 border-b border-[#d6dfd6] pb-5">
          <p className="text-sm text-[#59685d]">Order #{order.id}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
            {statusLabels[order.status]}
          </h1>
          <p className="mt-2 text-sm text-[#59685d]">
            {orderTypeLabel(order.orderType, order.businessCategory)} · Placed{" "}
            {new Date(order.createdAt).toLocaleString("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <CustomerOrderLiveUpdates trackingToken={trackingToken} />
          {order.scheduledFor && (
            <p className="mt-2 text-sm font-medium">
              Requested for{" "}
              {new Date(order.scheduledFor).toLocaleString("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Manila",
              })}{" "}
              (Philippine time)
            </p>
          )}
          {order.orderType === "DINE_IN" && order.tableNumber && (
            <p className="mt-2 text-sm font-medium">
              Table {order.tableNumber}
            </p>
          )}
        </div>

        <section aria-labelledby="order-items-heading" className="py-5">
          <h2 id="order-items-heading" className="text-base font-semibold">
            Order details
          </h2>
          <ul className="mt-4 divide-y divide-[#e4e9e2]">
            {order.items.map((item, index) => (
              <li
                key={`${item.productName}-${index}`}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {quantityLabel(item.quantity, item.quantityUnit)} ×{" "}
                    {item.productName}
                  </p>
                  {item.productType !== "PHYSICAL" && (
                    <p className="mt-1 text-[#59685d]">
                      {item.productType === "MADE_TO_ORDER"
                        ? "Made to order"
                        : "Service"}
                    </p>
                  )}
                  {item.optionLabel && (
                    <p className="mt-1 text-[#59685d]">{item.optionLabel}</p>
                  )}
                  {item.addOns.length > 0 && (
                    <p className="mt-1 text-[#59685d]">
                      Options:{" "}
                      {item.addOns.map((addon) => addon.optionName).join(", ")}
                    </p>
                  )}
                  {item.productAnswers.length > 0 && (
                    <div className="mt-1 space-y-1 text-[#59685d]">
                      {item.productAnswers.map((answer) => (
                        <p key={answer.questionId}>
                          {answer.label}:{" "}
                          {answer.value === "true"
                            ? "Yes"
                            : answer.value === "false"
                              ? "No"
                              : answer.value}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                <span className="shrink-0 tabular-nums">
                  {peso(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>
          {order.formAnswers?.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-[#e4e9e2] pt-4">
              {order.formAnswers.map((answer) => (
                <p key={answer.questionId} className="text-sm">
                  <span className="text-[#59685d]">{answer.label}: </span>
                  {answer.value}
                </p>
              ))}
            </div>
          )}
          <div className="mt-3 flex justify-between border-t border-[#d6dfd6] pt-4 text-sm font-semibold">
            <span>
              {order.orderType === "DELIVERY" ? "Items subtotal" : "Total"}
            </span>
            <span className="tabular-nums">{peso(order.itemsSubtotal)}</span>
          </div>
          {order.orderType === "DELIVERY" && (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#59685d]">Delivery fee</span>
                <span>
                  {order.deliveryFee === null
                    ? "To be confirmed"
                    : peso(order.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-t border-[#d6dfd6] pt-3 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{peso(order.total)}</span>
              </div>
            </div>
          )}
        </section>

        <section
          aria-labelledby="payment-heading"
          className="border-t border-[#d6dfd6] py-5"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 id="payment-heading" className="text-base font-semibold">
              Payment
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${order.paymentStatus === "PAID" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}
            >
              {order.paymentStatus === "PAID"
                ? "Paid"
                : order.paymentMethod === "GCASH"
                  ? "Awaiting verification"
                  : "Unpaid"}
            </span>
          </div>
          <p className="mt-2 text-sm text-[#59685d]">
            {order.paymentMethod === "GCASH" ? "GCash" : "Cash"}
            {order.paymentMethod === "CASH" ? " · Pay the store in cash." : ""}
          </p>
          {order.paymentMethod === "GCASH" &&
            order.paymentStatus !== "PAID" &&
            order.status !== "CANCELLED" &&
            order.paymentInstructions && (
              <div className="mt-4 rounded-xl border border-[#d6dfd6] bg-white p-4">
                <p className="text-sm font-semibold">Send GCash payment to</p>
                <p className="mt-2 text-sm">
                  {order.paymentInstructions.gcashAccountName}
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-[#59685d]">
                  {order.paymentInstructions.gcashNumber}
                </p>
                {order.status !== "NEW" &&
                  !(
                    order.orderType === "DELIVERY" && order.deliveryFee === null
                  ) && (
                    <div className="mt-3 flex justify-between gap-4 border-t border-[#e4e9e2] pt-3 text-sm">
                      <span className="text-[#59685d]">Amount to send</span>
                      <span className="font-semibold tabular-nums">
                        {peso(
                          order.orderType === "DELIVERY"
                            ? order.total
                            : order.itemsSubtotal,
                        )}
                      </span>
                    </div>
                  )}
                <CopyPaymentDetails
                  accountNumber={order.paymentInstructions.gcashNumber}
                />
                {order.paymentInstructions.gcashQrUrl && (
                  <div className="mt-4 flex items-center gap-4 border-t border-[#e4e9e2] pt-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Merchant QR can be stored in OCI or linked by HTTPS. */}
                    <img
                      src={order.paymentInstructions.gcashQrUrl}
                      alt="GCash payment QR code"
                      className="size-28 rounded-lg border object-contain"
                    />
                    <a
                      href={order.paymentInstructions.gcashQrUrl}
                      download="gcash-payment-qr.webp"
                      className="inline-flex min-h-11 items-center font-medium text-[#244d35] underline underline-offset-4"
                    >
                      Download QR
                    </a>
                  </div>
                )}
                {(order.status === "NEW" ||
                  (order.orderType === "DELIVERY" &&
                    order.deliveryFee === null)) && (
                  <p className="mt-3 border-t border-[#e4e9e2] pt-3 text-xs leading-relaxed text-[#59685d]">
                    {order.orderType === "DELIVERY" &&
                    order.deliveryFee === null
                      ? "Wait for the store to confirm your order, delivery fee, and final total before sending payment."
                      : "Wait for the store to confirm your order before sending payment."}
                  </p>
                )}
              </div>
            )}
          {order.paymentMethod === "GCASH" &&
            order.paymentStatus === "UNPAID" &&
            order.status !== "CANCELLED" && (
              <p className="mt-3 text-xs leading-relaxed text-[#59685d]">
                After sending payment, the store will verify it and update this
                order.
              </p>
            )}
          {order.paymentMethod === "GCASH" &&
            order.paymentStatus === "UNPAID" &&
            order.status !== "NEW" &&
            order.status !== "CANCELLED" &&
            !(order.orderType === "DELIVERY" && order.deliveryFee === null) && (
              <PaymentProofUpload
                trackingToken={trackingToken}
                uploadedAt={order.paymentProof?.uploadedAt ?? null}
              />
            )}
          {order.paymentMethod === "GCASH" &&
            order.paymentStatus === "UNPAID" &&
            order.status === "CANCELLED" && (
              <p className="mt-3 text-sm leading-relaxed text-[#59685d]">
                This order was cancelled. Contact the store if you already sent
                payment.
              </p>
            )}
        </section>

        {order.status !== "READY" &&
          order.status !== "COMPLETED" &&
          order.status !== "CANCELLED" && (
            <CustomerReadyAlert trackingToken={trackingToken} />
          )}
        <p className="border-t border-[#d6dfd6] pt-4 text-sm leading-relaxed text-[#59685d]">
          Keep this page open to see order updates as they happen.
          {order.orderType !== "DINE_IN" &&
            " The store will contact you at the number you provided."}
        </p>
        <Link
          href={`/menu/${order.storeSlug}`}
          className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#244d35] underline underline-offset-4"
        >
          Back to the catalog
        </Link>
      </div>
    </main>
  );
}
