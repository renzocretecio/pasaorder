"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  LoaderCircle,
  MessageCircle,
  Send,
} from "lucide-react";
import type { CatalogStore, CustomerChat } from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { CatalogImage } from "@/features/catalog/catalog-image";
import {
  readCustomerChat,
  sendCustomerChatMessage,
  startCustomerChat,
} from "./customer-chat-actions";

type Session = { token: string; chat: CustomerChat };

export function CustomerChatView({
  store,
  style,
}: {
  store: CatalogStore;
  style: CSSProperties;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreFailed, setRestoreFailed] = useState(false);
  const [name, setName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const storageKey = `pasaorder:customer-chat:${store.slug}`;

  useEffect(() => {
    let active = true;
    const token = window.sessionStorage.getItem(storageKey);
    if (!token) {
      queueMicrotask(() => {
        if (active) setRestoring(false);
      });
      return () => {
        active = false;
      };
    }
    void readCustomerChat(token).then((result) => {
      if (!active) return;
      if (result.success) {
        setSession({ token, chat: result.chat });
      } else if (result.status === 404) {
        window.sessionStorage.removeItem(storageKey);
      } else {
        setRestoreFailed(true);
      }
      setRestoring(false);
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (session?.chat.messages.length)
      endRef.current?.scrollIntoView({ block: "end" });
  }, [session?.chat.messages.length]);

  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await startCustomerChat(store.slug, name);
      if (!result.success) {
        setError(result.message);
        return;
      }
      window.sessionStorage.setItem(storageKey, result.token);
      setSession({ token: result.token, chat: result.chat });
    });
  }

  function send(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!session || !messageText.trim() || pending) return;
    const text = messageText.trim();
    const messageId = crypto.randomUUID();
    setError("");
    startTransition(async () => {
      const result = await sendCustomerChatMessage(
        session.token,
        messageId,
        text,
      );
      if (!result.success) {
        setError(result.message);
        return;
      }
      setSession((current) =>
        current
          ? { ...current, chat: { ...current.chat, messages: result.messages } }
          : current,
      );
      setMessageText("");
    });
  }

  return (
    <main
      style={style}
      className="flex h-dvh min-h-0 flex-1 flex-col bg-[#f6f8f4] text-[#18251d] sm:px-5 sm:py-5"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden bg-white sm:rounded-[24px] sm:border sm:border-[#d6dfd6] sm:shadow-[0_18px_50px_-30px_rgba(23,61,44,0.28)]">
        <header className="flex items-center gap-3 border-b border-[#d6dfd6] px-4 py-3 sm:px-6 sm:py-4">
          <CatalogImage
            src={store.logoUrl}
            alt=""
            store
            className="size-11 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold leading-tight">
              {store.name}
            </p>
            <p className="mt-0.5 text-xs text-[#59685d]">Customer chat</p>
          </div>
          <Link
            href={`/menu/${store.slug}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-[var(--store-accent-ink)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-accent-ink)]"
          >
            <span className="hidden sm:inline">View menu</span>
            <span className="sm:hidden">Menu</span>
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </header>

        {restoring ? (
          <div
            className="flex flex-1 items-center justify-center gap-2 p-8 text-sm text-[#59685d]"
            role="status"
          >
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
            Opening chat…
          </div>
        ) : restoreFailed ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-base font-medium">
              Couldn&apos;t reopen your chat.
            </p>
            <p className="text-sm text-[#59685d]">
              Your messages are still saved. Check your connection and try
              again.
            </p>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-2 min-h-11 rounded-xl"
            >
              Retry
            </Button>
          </div>
        ) : !session ? (
          <div className="flex flex-1 flex-col justify-center px-5 py-12 sm:px-12">
            <div className="max-w-md">
              <span className="grid size-12 place-items-center rounded-2xl bg-[var(--store-accent-soft)] text-[var(--store-accent-ink)]">
                <MessageCircle className="size-6" aria-hidden="true" />
              </span>
              <h1 className="mt-6 text-[28px] font-semibold leading-[1.2] tracking-[-0.025em] sm:text-[34px]">
                Start a conversation with {store.name}
              </h1>
              <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-[#59685d]">
                Tell the store what you&apos;re looking for. Your messages will
                be saved for the owner to review.
              </p>
              <form onSubmit={start} className="mt-8 space-y-3">
                <label
                  htmlFor="customer-chat-name"
                  className="block text-[13px] font-medium"
                >
                  Your name
                </label>
                <input
                  id="customer-chat-name"
                  name="name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={120}
                  placeholder="What should we call you?"
                  className="h-12 w-full rounded-xl border border-[#859184] bg-white px-4 text-base outline-none placeholder:text-[#59685d] focus-visible:border-[var(--store-accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--store-accent-ink)]/20"
                />
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={pending || name.trim().length < 2}
                  className="mt-2 min-h-12 w-full rounded-xl bg-[var(--store-accent)] text-[var(--store-accent-text)] hover:opacity-90"
                >
                  {pending && (
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}
                  Continue to chat
                </Button>
              </form>
              <p className="mt-5 text-xs leading-relaxed text-[#59685d]">
                Store replies are not available yet. The owner may use AI to
                review your messages.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div
              className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8"
              aria-label="Conversation"
            >
              <div className="mx-auto max-w-2xl space-y-5">
                <div className="rounded-2xl bg-[#eef2ea] px-4 py-3 text-sm leading-relaxed text-[#334b39]">
                  <p className="font-medium">
                    Hi, {session.chat.customerName}.
                  </p>
                  <p className="mt-1">
                    Tell {store.name} what you&apos;d like to order. Your
                    messages will appear in the store&apos;s review queue.
                    Replies aren&apos;t available in this test chat yet.
                  </p>
                </div>
                {session.chat.status === "CONFIRMED" && (
                  <p
                    className="rounded-xl border border-[#d6dfd6] bg-[#f8faf7] px-4 py-3 text-sm text-[#334b39]"
                    role="status"
                  >
                    This chat is closed. The store has reviewed it.
                  </p>
                )}
                <ol className="space-y-3" aria-label="Your messages">
                  {session.chat.messages.map((message) => (
                    <li key={message.id} className="flex justify-end">
                      <div className="max-w-[min(85%,34rem)] rounded-2xl rounded-br-sm bg-[var(--store-accent)] px-4 py-3 text-sm leading-relaxed text-[var(--store-accent-text)] shadow-[0_5px_14px_-10px_rgba(23,61,44,0.45)]">
                        <p className="break-words">{message.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div ref={endRef} />
              </div>
            </div>
            <div className="border-t border-[#d6dfd6] bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-8 sm:pb-5">
              <form
                onSubmit={send}
                className="mx-auto flex max-w-2xl items-end gap-2"
              >
                <label htmlFor="customer-chat-message" className="sr-only">
                  Your message
                </label>
                <textarea
                  id="customer-chat-message"
                  rows={1}
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter" &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      send();
                    }
                  }}
                  disabled={session.chat.status !== "DRAFT" || pending}
                  maxLength={1000}
                  placeholder={
                    session.chat.status === "DRAFT"
                      ? "Write your message…"
                      : "Chat closed"
                  }
                  className="min-h-12 max-h-36 min-w-0 flex-1 resize-y rounded-xl border border-[#859184] bg-white px-4 py-3 text-base leading-6 outline-none placeholder:text-[#59685d] focus-visible:border-[var(--store-accent-ink)] focus-visible:ring-2 focus-visible:ring-[var(--store-accent-ink)]/20 disabled:bg-[#f4f6f2]"
                />
                <Button
                  type="submit"
                  size="icon"
                  aria-label="Send message"
                  disabled={
                    pending ||
                    !messageText.trim() ||
                    session.chat.status !== "DRAFT"
                  }
                  className="size-12 rounded-xl bg-[var(--store-accent)] text-[var(--store-accent-text)] hover:opacity-90"
                >
                  {pending ? (
                    <LoaderCircle
                      className="size-5 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-5" aria-hidden="true" />
                  )}
                </Button>
              </form>
              {error && (
                <p
                  role="alert"
                  className="mx-auto mt-2 max-w-2xl text-sm text-destructive"
                >
                  {error}
                </p>
              )}
              <p className="mx-auto mt-2 max-w-2xl text-xs text-[#59685d]">
                Messages are saved for the store. No automatic reply is sent.
              </p>
            </div>
          </>
        )}
      </div>
      <div className="mx-auto hidden w-full max-w-3xl items-center justify-between px-1 pt-3 text-xs text-[#59685d] sm:flex">
        <Link
          href={`/menu/${store.slug}`}
          className="inline-flex items-center gap-1 hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to menu
        </Link>
        <span>Powered by PasaOrder</span>
      </div>
    </main>
  );
}
