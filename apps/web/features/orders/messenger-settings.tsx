"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, MessageCircle, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  disconnectMessenger,
  selectMessengerPage,
  startMessengerConnect,
} from "./messenger-actions";

type Page = { id: string; name: string };
type Connection = {
  pageId: string;
  pageName: string;
  connectedAt: string;
} | null;

export function MessengerSettings({
  storeId,
  configured,
  connection,
  sessionToken,
  pages,
  initialMessage,
}: {
  storeId: string;
  configured: boolean;
  connection: Connection;
  sessionToken?: string;
  pages: Page[];
  initialMessage?: string;
}) {
  const [pageId, setPageId] = useState(pages[0]?.id ?? "");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [isError, setIsError] = useState(Boolean(initialMessage));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function connect() {
    setMessage("");
    startTransition(async () => {
      const result = await startMessengerConnect(storeId);
      if ("error" in result) {
        setMessage(result.error);
        setIsError(true);
      } else {
        window.location.assign(result.url);
      }
    });
  }

  function selectPage() {
    if (!sessionToken || !pageId) return;
    setMessage("");
    startTransition(async () => {
      const result = await selectMessengerPage(storeId, sessionToken, pageId);
      if (!result.success) {
        setMessage(result.message);
        setIsError(true);
      } else {
        router.replace(`/dashboard/stores/${storeId}/settings`);
        router.refresh();
      }
    });
  }

  function disconnect() {
    setMessage("");
    startTransition(async () => {
      const result = await disconnectMessenger(storeId);
      if (!result.success) {
        setMessage(result.message);
        setIsError(true);
      } else {
        setMessage("Facebook Page disconnected.");
        setIsError(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-8 border-t pt-6" aria-labelledby="messenger-heading">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="messenger-heading" className="text-lg font-semibold">
            Facebook Messenger
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Receive customer messages in this store’s chat inbox. You review
            every conversation before confirming an order.
          </p>
        </div>
      </div>

      {connection ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{connection.pageName}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connected Facebook Page
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={disconnect}
            disabled={pending}
            className="min-h-11 rounded-xl self-start sm:self-auto"
          >
            {pending ? (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Unplug className="size-4" aria-hidden="true" />
            )}
            Disconnect
          </Button>
        </div>
      ) : sessionToken && pages.length ? (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <label
            htmlFor="messenger-page"
            className="mb-1.5 block text-[13px] font-medium"
          >
            Choose a Facebook Page
          </label>
          <select
            id="messenger-page"
            value={pageId}
            onChange={(event) => setPageId(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm sm:max-w-sm"
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={selectPage}
            disabled={pending || !pageId}
            className="mt-3 min-h-11 rounded-xl"
          >
            {pending && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Connect Page
          </Button>
        </div>
      ) : configured ? (
        <Button
          type="button"
          onClick={connect}
          disabled={pending}
          className="mt-4 min-h-11 rounded-xl"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <MessageCircle className="size-4" aria-hidden="true" />
          )}
          Connect Facebook Page
        </Button>
      ) : (
        <p className="mt-4 rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
          Add the Meta app settings to the API environment to enable connection.
          A public HTTPS callback URL is required.
        </p>
      )}

      {sessionToken && pages.length === 0 && !initialMessage && (
        <p className="mt-4 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
          No Facebook Pages were available for the selected account. Grant Page
          access and connect again.
        </p>
      )}
      {message && (
        <p
          role={isError ? "alert" : "status"}
          className={`mt-3 text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
