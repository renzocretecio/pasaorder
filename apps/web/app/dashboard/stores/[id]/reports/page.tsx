import type { Metadata } from "next";
import { ChartNoAxesCombined, PackageCheck, ReceiptText } from "lucide-react";
import type { StoreOverview } from "@pasaorder/types";
import { overviewDateRangeSchema } from "@pasaorder/validation";
import { peso } from "@/features/catalog/color";
import { formatQuantity } from "@/features/catalog/quantity";
import { PageHeading } from "@/features/catalog/workspace";
import { OverviewDateRange } from "@/features/orders/overview-date-range";
import { OverviewRefresh } from "@/features/orders/overview-refresh";
import { SalesTrendChart } from "@/features/orders/sales-trend-chart";
import { getOwnerCatalog, ownerApi } from "@/lib/catalog";

export const metadata: Metadata = { title: "Sales reports | PasaOrder" };

function dateLabel(from: string, to: string) {
  const format = new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const start = format.format(new Date(`${from}T12:00:00Z`));
  const end = format.format(new Date(`${to}T12:00:00Z`));
  return from === to ? start : `${start} – ${end}`;
}

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default async function StoreReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id } = await params;
  const { from, to } = await searchParams;
  const hasDateSelection = from !== undefined || to !== undefined;
  const today = todayInManila();
  const selectedRange = hasDateSelection
    ? overviewDateRangeSchema.safeParse({ from, to })
    : {
        success: true as const,
        data: { from: shiftDate(today, -6), to: today },
      };
  const rangeQuery = selectedRange.success
    ? `?${new URLSearchParams(selectedRange.data)}`
    : "";
  const [{ store }, { overview }] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<{ overview: StoreOverview }>(
      `/orders/stores/${id}/overview${rangeQuery}`,
    ),
  ]);
  const base = `/dashboard/stores/${id}`;
  return (
    <div className="space-y-7 pb-5 lg:space-y-8">
      <PageHeading
        title="Sales reports"
        description={`${store.name} · ${dateLabel(overview.from, overview.to)}`}
      >
        <OverviewDateRange
          from={overview.from}
          to={overview.to}
          today={overview.date}
          basePath={`${base}/reports`}
        />
      </PageHeading>

      <OverviewRefresh />

      {hasDateSelection && !selectedRange.success && (
        <p role="alert" className="text-sm text-destructive">
          Choose a valid range with the start date on or before the end date.
          Showing today.
        </p>
      )}

      <section
        aria-label="Sales report totals"
        className="grid gap-3 sm:grid-cols-2"
      >
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ChartNoAxesCombined
              className="size-4 text-primary"
              aria-hidden="true"
            />
            Sales
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] tabular-nums">
            {peso(overview.sales)}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            From completed orders in this period
          </p>
        </div>
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ReceiptText className="size-4 text-primary" aria-hidden="true" />
            Orders received
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-[-0.03em] tabular-nums">
            {overview.ordersCount}
          </p>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Orders placed in this period, including open orders
          </p>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(18rem,0.9fr)]">
        <section
          aria-labelledby="sales-trend-title"
          className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
        >
          <div className="mb-2">
            <h2
              id="sales-trend-title"
              className="text-base font-semibold tracking-[-0.01em]"
            >
              Sales over time
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Daily totals from completed orders
            </p>
          </div>
          {overview.salesTrend.length ? (
            <SalesTrendChart days={overview.salesTrend} />
          ) : (
            <div className="grid min-h-64 place-items-center text-center">
              <p className="text-sm text-muted-foreground">
                No completed sales in this period yet.
              </p>
            </div>
          )}
        </section>

        <section
          aria-labelledby="popular-products-title"
          className="min-w-0 rounded-xl border bg-card p-4 sm:p-5"
        >
          <div className="mb-4">
            <h2
              id="popular-products-title"
              className="text-base font-semibold tracking-[-0.01em]"
            >
              Popular products
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Ranked by units sold in this period
            </p>
          </div>
          {overview.topProducts.length ? (
            <ol className="divide-y">
              {overview.topProducts.map((product, index) => (
                <li
                  key={product.productId}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold tabular-nums text-primary">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatQuantity(product.units)}{" "}
                      {product.quantityUnit === "KG"
                        ? "kg"
                        : product.units === 1
                          ? "unit"
                          : "units"}{" "}
                      sold
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {peso(product.revenue)}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <div className="grid min-h-48 place-items-center px-4 text-center">
              <div>
                <PackageCheck
                  className="mx-auto size-6 text-muted-foreground"
                  aria-hidden="true"
                />
                <p className="mt-3 text-sm font-medium">
                  No completed products yet
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Completed orders will show which products sell the most.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
