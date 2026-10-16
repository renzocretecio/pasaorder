"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Popover } from "radix-ui";
import { CalendarDays, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const dayFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const fullDayFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("en-PH", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function dateFromKey(key: string) {
  return new Date(`${key}T12:00:00.000Z`);
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(key: string, days: number) {
  const date = dateFromKey(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function monthStart(key: string) {
  const date = dateFromKey(key);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
}

function addMonths(date: Date, months: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12),
  );
}

function calendarDays(viewMonth: Date) {
  const first = new Date(
    Date.UTC(
      viewMonth.getUTCFullYear(),
      viewMonth.getUTCMonth(),
      1 - viewMonth.getUTCDay(),
      12,
    ),
  );
  return Array.from({ length: 42 }, (_, index) =>
    addDays(dateKey(first), index),
  );
}

export function OverviewDateRange({
  from,
  to,
  today,
  basePath,
}: {
  from: string;
  to: string;
  today: string;
  basePath: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => monthStart(from));
  const [pending, beginNavigation] = useTransition();
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
    { label: "This month", from: `${today.slice(0, 7)}-01`, to: today },
  ];
  const days = calendarDays(viewMonth);
  const nextMonthDisabled = addMonths(viewMonth, 1) > monthStart(today);

  function navigate(nextFrom: string, nextTo: string) {
    setOpen(false);
    setStart(null);
    beginNavigation(() => {
      router.push(
        nextFrom === today && nextTo === today
          ? basePath
          : `${basePath}?${new URLSearchParams({ from: nextFrom, to: nextTo })}`,
      );
    });
  }

  function selectDay(key: string) {
    if (key > today || (start && key > addDays(start, 364))) return;
    if (!start || key < start) {
      setStart(key);
      return;
    }
    navigate(start, key);
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) {
          setStart(null);
          setViewMonth(monthStart(to));
        }
      }}
    >
      <Popover.Trigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          aria-label="Select report date range"
          className="h-11 w-full justify-start rounded-xl border-input bg-card px-3 text-left shadow-none sm:w-auto"
        >
          <CalendarDays className="size-4 text-primary" aria-hidden="true" />
          <span className="truncate">
            {from === to
              ? dayFormatter.format(dateFromKey(from))
              : `${dayFormatter.format(dateFromKey(from))} – ${dayFormatter.format(dateFromKey(to))}`}
          </span>
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[calc(100vw-2rem)] max-w-[22rem] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl outline-none sm:flex sm:w-auto sm:max-w-none"
        >
          <div className="grid grid-cols-2 gap-1 border-b bg-muted/30 p-3 sm:w-36 sm:grid-cols-1 sm:content-start sm:border-r sm:border-b-0">
            <p className="col-span-2 px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:col-span-1">
              Quick presets
            </p>
            {presets.map((preset) => {
              const selected = from === preset.from && to === preset.to;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => navigate(preset.from, preset.to)}
                  className={cn(
                    "flex min-h-10 items-center justify-between gap-1 rounded-lg px-2.5 text-left text-[13px] font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                    selected && "bg-primary/10 text-primary",
                  )}
                >
                  {preset.label}
                  {selected && (
                    <Check className="size-3.5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="p-4 sm:w-[21rem]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <strong className="text-sm font-semibold">
                {monthFormatter.format(viewMonth)}
              </strong>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Previous month"
                  className="size-9 rounded-lg"
                  onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Next month"
                  className="size-9 rounded-lg"
                  disabled={nextMonthDisabled}
                  onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">
              {start
                ? `Select an end date after ${dayFormatter.format(dateFromKey(start))}`
                : "Select the first date"}
            </p>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {weekdays.map((day) => (
                <span
                  key={day}
                  className="grid h-7 place-items-center text-[11px] font-semibold text-muted-foreground"
                >
                  {day}
                </span>
              ))}
              {days.map((key) => {
                const disabled =
                  key > today || Boolean(start && key > addDays(start, 364));
                const selectedStart = key === (start ?? from);
                const selectedEnd = !start && key === to;
                const inRange = !start && key > from && key < to;
                const currentMonth =
                  key.slice(0, 7) === dateKey(viewMonth).slice(0, 7);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={fullDayFormatter.format(dateFromKey(key))}
                    aria-pressed={selectedStart || selectedEnd}
                    disabled={disabled}
                    onClick={() => selectDay(key)}
                    className={cn(
                      "aspect-square min-h-9 w-full rounded-lg text-xs tabular-nums transition-colors hover:bg-muted focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-25",
                      !currentMonth && "text-muted-foreground",
                      inRange && "rounded-none bg-primary/10 text-primary",
                      (selectedStart || selectedEnd) &&
                        "bg-primary font-semibold text-primary-foreground hover:bg-primary/90",
                    )}
                  >
                    {dateFromKey(key).getUTCDate()}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Up to 365 days · Philippine dates
            </p>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
