"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, LoaderCircle, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  disconnectInstagram,
  selectInstagramAccount,
  startInstagramConnect,
} from "./messenger-actions";

type Account = { id: string; username: string; pageName: string };
type Connection = {
  instagramId: string;
  instagramUsername: string;
  connectedAt: string;
} | null;

export function InstagramSettings({
  storeId,
  configured,
  connection,
  sessionToken,
  accounts,
  initialMessage,
}: {
  storeId: string;
  configured: boolean;
  connection: Connection;
  sessionToken?: string;
  accounts: Account[];
  initialMessage?: string;
}) {
  const [instagramId, setInstagramId] = useState(accounts[0]?.id ?? "");
  const [message, setMessage] = useState(initialMessage ?? "");
  const [isError, setIsError] = useState(Boolean(initialMessage));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function connect() {
    setMessage("");
    startTransition(async () => {
      const result = await startInstagramConnect(storeId);
      if ("error" in result) {
        setMessage(result.error);
        setIsError(true);
      } else {
        window.location.assign(result.url);
      }
    });
  }

  function selectAccount() {
    if (!sessionToken || !instagramId) return;
    setMessage("");
    startTransition(async () => {
      const result = await selectInstagramAccount(
        storeId,
        sessionToken,
        instagramId,
      );
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
      const result = await disconnectInstagram(storeId);
      if (!result.success) {
        setMessage(result.message);
        setIsError(true);
      } else {
        setMessage("Instagram account disconnected.");
        setIsError(false);
        router.refresh();
      }
    });
  }

  return (
    <section className="mt-8 border-t pt-6" aria-labelledby="instagram-heading">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <Camera className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="instagram-heading" className="text-lg font-semibold">
            Instagram messages
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Bring Instagram DMs into this store’s chat inbox. Connect a
            professional account linked to a Facebook Page.
          </p>
        </div>
      </div>

      {connection ? (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">
              @{connection.instagramUsername}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connected Instagram professional account
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
      ) : sessionToken && accounts.length ? (
        <div className="mt-4 rounded-xl border bg-card p-4">
          <label
            htmlFor="instagram-account"
            className="mb-1.5 block text-[13px] font-medium"
          >
            Choose an Instagram account
          </label>
          <select
            id="instagram-account"
            value={instagramId}
            onChange={(event) => setInstagramId(event.target.value)}
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm sm:max-w-sm"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                @{account.username} · {account.pageName}
              </option>
            ))}
          </select>
          <Button
            type="button"
            onClick={selectAccount}
            disabled={pending || !instagramId}
            className="mt-3 min-h-11 rounded-xl"
          >
            {pending && (
              <LoaderCircle
                className="size-4 animate-spin"
                aria-hidden="true"
              />
            )}
            Connect Instagram
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
            <Camera className="size-4" aria-hidden="true" />
          )}
          Connect Instagram
        </Button>
      ) : (
        <p className="mt-4 rounded-xl bg-muted/60 p-4 text-sm leading-relaxed text-muted-foreground">
          Add the Meta app settings to the API environment to enable connection.
          A public HTTPS callback URL is required.
        </p>
      )}

      {sessionToken && accounts.length === 0 && !initialMessage && (
        <p className="mt-4 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
          No eligible Instagram accounts were found. Switch the account to
          Business or Creator, link it to a Facebook Page, then try again.
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
