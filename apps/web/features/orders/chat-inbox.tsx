"use client";

import { useEffect, useState, useTransition } from "react";
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
}: {
  storeId: string;
  drafts: ChatOrderDraftSummary[];
  analysisAvailable: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("ALL");
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
            Updates automatically every 10 seconds.
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
          Intent sorting is unavailable until Clef-flash is configured. Chats
          stay in Needs attention.
        </p>
      )}
      {visible.length ? (
        <ul className="divide-y">
          {visible.map((draft) => {
            const Icon =
              draft.source === "MESSENGER"
                ? MessageCircleMore
                : draft.source === "INSTAGRAM"
                  ? Camera
                  : MessageCircle;
            const possible = draft.inboxBucket === "POSSIBLE_ORDER";
            return (
              <li key={draft.id}>
                <Link
                  href={`/dashboard/stores/${storeId}/chat-orders/${draft.id}`}
                  className="group flex min-h-28 items-start gap-3 px-4 py-4 outline-none transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:items-center sm:gap-4 sm:px-6"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {draft.draftData.customerName || "Customer"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {draft.source === "WEB_CHAT"
                          ? "Web chat"
                          : draft.source === "MESSENGER"
                            ? "Messenger"
                            : "Instagram"}{" "}
                        ·{" "}
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
                          ? "bg-secondary text-primary"
                          : "bg-muted text-foreground",
                      )}
                    >
                      {possible
                        ? "Possible order"
                        : draft.inboxBucket === "NEEDS_ATTENTION"
                          ? "Needs attention"
                          : "No action needed"}
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
        <div className="px-5 py-12 sm:px-6">
          <p className="text-sm font-medium">
            {filter === "ALL"
              ? "No conversations yet"
              : filter === "POSSIBLE_ORDER"
                ? "No possible orders"
                : "Nothing needs attention"}
          </p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            {filter === "ALL"
              ? "Open the customer chat to test a conversation for this store. New messages will appear here."
              : "Try another filter or refresh for new customer messages."}
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
