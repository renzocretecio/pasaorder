"use client";

import { useEffect, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  MessageCircle,
  MessageCircleMore,
  RefreshCw,
} from "lucide-react";
import type { ChatOrderDraftSummary } from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Filter = "ALL" | "POSSIBLE_ORDER" | "NEEDS_ATTENTION";

export function ChatInbox({
  storeId,
  drafts,
  analysisAvailable,
  initialFilter,
}: {
  storeId: string;
  drafts: ChatOrderDraftSummary[];
  analysisAvailable: boolean;
  initialFilter?: string;
}) {
  const [filter, setFilter] = useState<Filter>(
    initialFilter === "POSSIBLE_ORDER" || initialFilter === "NEEDS_ATTENTION"
      ? initialFilter
      : "ALL",
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible" && !pending)
        startTransition(() => router.refresh());
    };
    const interval = window.setInterval(refreshWhenVisible, 10_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [pending, router, startTransition]);
  const possibleCount = drafts.filter(
    (draft) => draft.inboxBucket === "POSSIBLE_ORDER",
  ).length;
  const attentionCount = drafts.filter(
    (draft) => draft.inboxBucket === "NEEDS_ATTENTION",
  ).length;
  const normalCount = drafts.length - possibleCount - attentionCount;
  const visible =
    filter === "ALL"
      ? drafts
      : drafts.filter((draft) => draft.inboxBucket === filter);
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "ALL", label: "All", count: drafts.length },
    { value: "POSSIBLE_ORDER", label: "Possible order", count: possibleCount },
    {
      value: "NEEDS_ATTENTION",
      label: "Needs attention",
      count: attentionCount,
    },
  ];

  return (
    <section
      aria-label="Customer conversations"
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <div className="flex flex-col gap-4 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="text-lg font-semibold tracking-[-0.01em]">Inbox</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {drafts.length}{" "}
            {drafts.length === 1 ? "conversation" : "conversations"} waiting for
            review
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span
              aria-hidden="true"
              className="mr-2 inline-block size-2 rounded-full bg-[#4c8a50] align-middle"
            />
            Live updates · refreshes every 10 seconds
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => router.refresh())}
          className="min-h-11 self-start rounded-xl sm:self-auto"
        >
          <RefreshCw
            className={cn("size-4", pending && "animate-spin")}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </div>
      <div className="grid grid-cols-3 divide-x border-b bg-[#fbfcfa] px-3 py-3.5 sm:px-6 sm:py-4">
        <div className="px-2 sm:px-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-[#37794b]"
            />
            Possible orders
          </p>
          <p className="mt-1.5 text-xl font-semibold leading-none tabular-nums text-[#244d35] sm:text-2xl">
            {possibleCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Ready to review</p>
        </div>
        <div className="px-2 sm:px-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-amber-500"
            />
            Needs attention
          </p>
          <p className="mt-1.5 text-xl font-semibold leading-none tabular-nums text-amber-900 sm:text-2xl">
            {attentionCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Questions or changes
          </p>
        </div>
        <div className="px-2 sm:px-3">
          <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-[#9aa49b]"
            />
            All conversations
          </p>
          <p className="mt-1.5 text-xl font-semibold leading-none tabular-nums sm:text-2xl">
            {drafts.length}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {normalCount} {normalCount === 1 ? "acknowledgement" : "other"}
          </p>
        </div>
      </div>
      <div
        className="flex gap-1 overflow-x-auto border-b px-3 py-2 sm:px-5"
        role="group"
        aria-label="Filter conversations"
      >
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
              filter === option.value
                ? "bg-secondary text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
            <span className="tabular-nums text-xs opacity-75">
              {option.count}
            </span>
          </button>
        ))}
      </div>
      {!analysisAvailable && (
        <p className="border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground sm:px-6">
          Intent sorting is unavailable until ThinkLess is configured. Chats
          stay in Needs attention.
        </p>
      )}
      {visible.length ? (
        <ul className="divide-y">
          {visible.map((draft, index) => {
            const Icon =
              draft.source === "MESSENGER"
                ? MessageCircleMore
                : draft.source === "INSTAGRAM"
                  ? Camera
                  : MessageCircle;
            const possible = draft.inboxBucket === "POSSIBLE_ORDER";
            const needsAttention = draft.inboxBucket === "NEEDS_ATTENTION";
            const customerName = draft.draftData.customerName || "Customer";
            const initials = customerName
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <li
                key={draft.id}
                className="chat-inbox-arrive"
                style={{ "--chat-index": Math.min(index, 6) } as CSSProperties}
              >
                <Link
                  href={`/dashboard/stores/${storeId}/chat-orders/${draft.id}`}
                  className="group flex min-h-28 items-start gap-3 px-4 py-4 outline-none transition-[background-color,box-shadow] duration-200 hover:bg-[#f7faf5] focus-visible:bg-[#f7faf5] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:items-center sm:gap-4 sm:px-6"
                >
                  <span
                    className={cn(
                      "relative grid size-11 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 ring-inset ring-black/5 sm:size-12",
                      possible
                        ? "bg-[#e4f0d5] text-[#244d35]"
                        : needsAttention
                          ? "bg-amber-100 text-amber-950"
                          : "bg-secondary text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {initials || <Icon className="size-5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {customerName}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                        <Icon className="size-3.5" aria-hidden="true" />
                        {draft.source === "WEB_CHAT"
                          ? "Web chat"
                          : draft.source === "MESSENGER"
                            ? "Messenger"
                            : "Instagram"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(draft.updatedAt).toLocaleDateString("en-PH", {
                          month: "short",
                          day: "numeric",
                          timeZone: "Asia/Manila",
                        })}
                      </span>
                    </span>
                    <span className="mt-1.5 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {draft.latestMessage ||
                        "Open this conversation to review its messages."}
                    </span>
                    <span
                      className={cn(
                        "mt-2 inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
                        possible
                          ? "bg-[#e8eee5] text-[#244d35]"
                          : needsAttention
                            ? "bg-amber-50 text-amber-900"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {possible
                        ? "Possible order"
                        : needsAttention
                          ? "Needs attention"
                          : "Acknowledgement"}
                    </span>
                  </span>
                  <span className="mt-2 inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary sm:mt-0">
                    Review
                    <ArrowRight
                      className="size-4 transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-5 py-12 text-center sm:px-6">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-secondary text-primary">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold">
            {filter === "ALL"
              ? "Your inbox is ready"
              : filter === "POSSIBLE_ORDER"
                ? "No possible orders right now"
                : "Nothing needs attention right now"}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            {filter === "ALL"
              ? "When customers message your store, their conversations will show up here for review."
              : "New conversations will appear here when they need this kind of review."}
          </p>
        </div>
      )}
      <div className="border-t px-4 py-3 sm:px-6">
        <Link
          href={`/dashboard/stores/${storeId}/orders`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
        >
          Back to orders
        </Link>
      </div>
    </section>
  );
}
