"use client";

import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import type { StoreOverview } from "@pasaorder/types";
import { peso } from "@/features/catalog/color";

export function SalesTrendChart({
  days,
}: {
  days: StoreOverview["salesTrend"];
}) {
  const data = days.map((day) => ({
    date: new Date(`${day.date}T12:00:00`),
    sales: Number(day.sales),
  }));

  function tooltipContent(point: Record<string, unknown>) {
    const date =
      point.date instanceof Date ? point.date : new Date(String(point.date));
    return (
      <div className="min-w-40 px-3 py-2.5">
        <p className="text-xs font-medium text-muted-foreground">
          {date.toLocaleDateString("en-PH", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-primary"
          />
          <span className="text-muted-foreground">Sales</span>
          <strong className="ml-auto font-semibold tabular-nums text-foreground">
            {peso(String(point.sales ?? 0))}
          </strong>
        </div>
      </div>
    );
  }

  return (
    <figure>
      <figcaption className="sr-only">
        Completed order sales by placement date over the last seven days
      </figcaption>
      <AreaChart
        data={data}
        aspectRatio="auto"
        className="h-56 sm:h-64"
        margin={{ top: 16, right: 16, bottom: 40, left: 16 }}
        animationDuration={450}
        style={{ touchAction: "pan-y" }}
      >
        <Grid horizontal numTicksRows={4} stroke="var(--border)" />
        <Area
          dataKey="sales"
          fill="var(--primary)"
          fillOpacity={0.18}
          stroke="var(--primary)"
          strokeWidth={2.5}
          showMarkers
          markers={{ radius: 3, fill: "var(--primary)", strokeWidth: 0 }}
        />
        <XAxis numTicks={4} />
        <ChartTooltip
          indicatorColor="var(--primary)"
          showDatePill={false}
          panelStyle={{
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            backdropFilter: "none",
          }}
          content={({ point }) => tooltipContent(point)}
        />
      </AreaChart>
      <details className="mt-3 border-t pt-3">
        <summary className="w-fit cursor-pointer rounded-md py-2 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring">
          View daily totals
        </summary>
        <dl className="mt-1 divide-y text-sm">
          {days.map((day) => (
            <div key={day.date} className="flex justify-between gap-4 py-2">
              <dt>
                {new Date(`${day.date}T12:00:00Z`).toLocaleDateString("en-PH", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </dt>
              <dd className="font-medium tabular-nums">{peso(day.sales)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </figure>
  );
}
