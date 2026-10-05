import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError, authApi } from "@/lib/auth";
import { peso } from "@/features/catalog/color";

type TrackedOrder = {
  id: string;
  storeName: string;
  storeSlug: string;
  status:
    "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";
  orderType: "DINE_IN" | "PICKUP" | "DELIVERY";
  tableNumber: string | null;
  itemsSubtotal: string;
  total: string;
  deliveryFee: string | null;
  createdAt: string;
  items: {
    productName: string;
    optionLabel: string | null;
    quantity: number;
    unitPrice: string;
    subtotal: string;
  }[];
};

const statusLabels: Record<TrackedOrder["status"], string> = {
  NEW: "Waiting for store review",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const orderTypeLabels: Record<TrackedOrder["orderType"], string> = {
  DINE_IN: "Dine in",
  PICKUP: "Takeaway",
  DELIVERY: "Delivery",
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
            {orderTypeLabels[order.orderType]} · Placed{" "}
            {new Date(order.createdAt).toLocaleString("en-PH", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
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
                    {item.quantity} × {item.productName}
                  </p>
                  {item.optionLabel && (
                    <p className="mt-1 text-[#59685d]">{item.optionLabel}</p>
                  )}
                </div>
                <span className="shrink-0 tabular-nums">
                  {peso(item.subtotal)}
                </span>
              </li>
            ))}
          </ul>
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

        <p className="border-t border-[#d6dfd6] pt-4 text-sm leading-relaxed text-[#59685d]">
          Keep this page to check your order status. Refresh it for the latest
          update.
          {order.orderType !== "DINE_IN" &&
            " The store will contact you at the number you provided."}
        </p>
        <Link
          href={`/menu/${order.storeSlug}`}
          className="mt-5 inline-flex min-h-11 items-center text-sm font-semibold text-[#244d35] underline underline-offset-4"
        >
          Back to the menu
        </Link>
      </div>
    </main>
  );
}
