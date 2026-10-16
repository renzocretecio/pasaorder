import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, ShoppingBag } from "lucide-react";
import type { OrderStatus, OwnerOrder, StoreOverview } from "@pasaorder/types";
import { overviewDateRangeSchema } from "@pasaorder/validation";
import { peso } from "@/features/catalog/color";
import { OverviewRefresh } from "@/features/orders/overview-refresh";
import { OverviewDateRange } from "@/features/orders/overview-date-range";
import { PageHeading } from "@/features/catalog/workspace";
import { getOwnerCatalog, ownerApi } from "@/lib/catalog";

export const metadata: Metadata = { title: "Overview | PasaOrder" };

const statusStyle: Record<OrderStatus, string> = {
  NEW: "bg-amber-50 text-amber-900",
  CONFIRMED: "bg-secondary text-primary",
  PREPARING: "bg-amber-50 text-amber-900",
  READY: "bg-emerald-50 text-emerald-800",
  COMPLETED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-50 text-red-800",
};

function Metric({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string | number;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="text-[13px] font-medium text-muted-foreground">
        {label}
      </span>
      <strong className="mt-2 block text-[28px] font-semibold leading-none tracking-[-0.025em] tabular-nums">
        {value}
      </strong>
      <span className="mt-3 block text-xs leading-5 text-muted-foreground">
        {detail}
      </span>
    </>
  );
  const className =
    "min-w-0 rounded-xl border bg-card px-4 py-4 sm:px-5 sm:py-5";
  return href ? (
    <Link
      href={href}
      className={`${className} transition-colors hover:border-primary/40 hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function orderItems(order: OwnerOrder) {
  return order.items
    .map(
      (item) =>
        `${item.quantity} × ${item.productName}${item.optionLabel ? ` (${item.optionLabel})` : ""}`,
    )
    .join(" · ");
}

function orderTime(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

export default async function StoreOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const hasDateSelection = from !== undefined || to !== undefined;
  const selectedRange = hasDateSelection
    ? overviewDateRangeSchema.safeParse({ from, to })
    : null;
  const rangeQuery = selectedRange?.success
    ? `?${new URLSearchParams(selectedRange.data)}`
    : "";
  const [{ store }, { overview }, { orders }] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<{ overview: StoreOverview }>(
      `/orders/stores/${id}/overview${rangeQuery}`,
    ),
    ownerApi<{ orders: OwnerOrder[] }>(`/orders/stores/${id}/recent-orders`),
  ]);
  const base = `/dashboard/stores/${id}`;
  const isToday =
    overview.from === overview.date && overview.to === overview.date;
  const dateLabel = new Date(`${overview.date}T12:00:00Z`).toLocaleDateString(
    "en-PH",
    {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    },
  );

  return (
    <div className="space-y-8 lg:space-y-10">
      <PageHeading
        title="Overview"
        description={`${store.name} · ${dateLabel}`}
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <OverviewDateRange
            from={overview.from}
            to={overview.to}
            today={overview.date}
            basePath={`${base}/overview`}
          />
          <Link
            href={`${base}/orders`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Manage orders <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </PageHeading>

      <OverviewRefresh />

      <section aria-labelledby="kpi-range-title" className="space-y-3">
        {hasDateSelection && !selectedRange?.success && (
          <p role="alert" className="text-sm text-destructive">
            Choose a valid range with the start date on or before the end date.
            Showing today.
          </p>
        )}
      </section>

      <section
        aria-label="Key metrics for selected dates"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        <Metric
          label={isToday ? "Today's sales" : "Sales"}
          value={peso(overview.sales)}
          detail="Completed orders placed in range"
        />
        <Metric
          label={isToday ? "Total orders today" : "Total orders"}
          value={overview.ordersCount}
          detail="Orders placed in range"
          href={`${base}/orders`}
        />
        <Metric
          label="Active orders"
          value={overview.activeOrders}
          detail={`${overview.awaitingConfirmation} awaiting confirmation · placed in range`}
          href={`${base}/orders?queue=NEW`}
        />
        <Metric
          label="Awaiting confirmation"
          value={overview.awaitingConfirmation}
          detail="New orders waiting for your review"
          href={`${base}/orders?queue=NEW`}
        />
      </section>

      <div className="max-w-5xl">
        <section aria-labelledby="recent-orders-title" className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2
                id="recent-orders-title"
                className="text-lg font-semibold tracking-[-0.01em]"
              >
                Recent orders
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Latest five orders from this store
              </p>
            </div>
            <Link
              href={`${base}/orders`}
              className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              All orders <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {orders.length ? (
              <ol className="divide-y">
                {orders.map((order) => {
                  const queue =
                    order.status === "COMPLETED" || order.status === "CANCELLED"
                      ? "HISTORY"
                      : order.status;
                  return (
                    <li
                      key={order.id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            Order #{order.id}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusStyle[order.status]}`}
                          >
                            {store.orderWorkflow.labels[order.status]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {orderTime(order.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-medium">
                          {order.customerName}
                        </p>
                        <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                          {orderItems(order) || "No items recorded"}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:gap-2">
                        <span className="text-sm font-semibold tabular-nums">
                          {peso(order.total)}
                        </span>
                        <Link
                          href={`${base}/orders?queue=${queue}&order=${order.id}#order-${order.id}`}
                          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          aria-label={`Manage order ${order.id}`}
                        >
                          Manage{" "}
                          <ArrowRight className="size-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="px-5 py-10 text-center">
                <ShoppingBag
                  className="mx-auto size-6 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-semibold">No orders yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Orders from your published catalog will appear here.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
