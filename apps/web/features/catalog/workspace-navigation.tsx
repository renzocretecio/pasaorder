"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { io } from "socket.io-client";
import {
  ChevronDown,
  ChartNoAxesCombined,
  LayoutDashboard,
  Plus,
  ShoppingBag,
  Store,
} from "lucide-react";
import type { WorkspaceStore } from "@pasaorder/types";
import { LogoutButton } from "@/components/auth/logout-button";
import { cn } from "@/lib/utils";
import { getSocketUrl } from "@/lib/socket-url";
import { setDefaultStore } from "./workspace-actions";

export function WorkspaceNavigation({
  name,
  email,
  stores,
}: {
  name: string;
  email: string;
  stores: WorkspaceStore[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const account = useRef<HTMLDetailsElement>(null);
  const storeMenu = useRef<HTMLDetailsElement>(null);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const creating = pathname === "/dashboard/new";
  const orders = pathname.endsWith("/orders");
  const overview = pathname.endsWith("/overview");
  const reports = pathname.endsWith("/reports");
  const routeStoreId = pathname.match(/^\/dashboard\/stores\/([^/]+)/)?.[1];
  const selectedStore =
    stores.find((store) => store.id === routeStoreId) ??
    stores.find((store) => store.isDefault);
  const selectedStoreId = selectedStore?.id;
  const catalogHref = selectedStore
    ? `/dashboard/stores/${selectedStore.id}`
    : "/dashboard";
  const ordersHref = selectedStore ? `${catalogHref}/orders` : "/dashboard";
  const overviewHref = selectedStore ? `${catalogHref}/overview` : "/dashboard";

  useEffect(() => {
    function close(event: PointerEvent) {
      const target = event.target as Node;
      if (account.current && !account.current.contains(target))
        account.current.open = false;
      if (storeMenu.current && !storeMenu.current.contains(target))
        storeMenu.current.open = false;
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (account.current?.open) {
        account.current.open = false;
        account.current.querySelector("summary")?.focus();
      }
      if (storeMenu.current?.open) {
        storeMenu.current.open = false;
        storeMenu.current.querySelector("summary")?.focus();
      }
    }
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  useEffect(() => {
    if (!selectedStoreId) return;
    let reconnectTimer: number | undefined;
    const socket = io(getSocketUrl(), {
      auth: (callback) => {
        fetch("/api/socket-token", { cache: "no-store" })
          .then(async (response) => {
            if (!response.ok)
              throw new Error("Unable to authenticate live updates");
            return response.json() as Promise<{ token: string }>;
          })
          .then(({ token }) => callback({ token }))
          .catch(() => callback({ token: "" }));
      },
      autoConnect: false,
    });
    socket.on("connect", () => {
      socket.emit(
        "store:join",
        { storeId: selectedStoreId },
        ({ ok }: { ok: boolean }) => {
          if (ok) router.refresh();
        },
      );
    });
    socket.on("orders:changed", (event: { storeId?: string }) => {
      if (
        (overview || reports) &&
        event.storeId === selectedStoreId &&
        document.visibilityState === "visible"
      )
        router.refresh();
    });
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect")
        reconnectTimer = window.setTimeout(() => socket.connect(), 0);
    });
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    socket.connect();
    return () => {
      window.clearTimeout(reconnectTimer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      socket.disconnect();
    };
  }, [overview, reports, router, selectedStoreId]);

  function chooseDefault(storeId: string) {
    setMessage("");
    startTransition(async () => {
      const result = await setDefaultStore(storeId);
      setMessage(result.message);
      if (result.success) router.refresh();
    });
  }

  const links = [
    {
      href: overviewHref,
      label: "Overview",
      icon: LayoutDashboard,
      active: Boolean(selectedStore) && overview,
      count: 0,
    },
    {
      href: selectedStore ? `${catalogHref}/reports` : "/dashboard",
      label: "Reports",
      icon: ChartNoAxesCombined,
      active: Boolean(selectedStore) && reports,
      count: 0,
    },
    {
      href: catalogHref,
      label: "Catalog",
      icon: Store,
      active:
        Boolean(selectedStore) && !creating && !orders && !overview && !reports,
      count: 0,
    },
    {
      href: ordersHref,
      label: "Orders",
      icon: ShoppingBag,
      active: Boolean(selectedStore) && orders,
      count: 0,
    },
  ];

  return (
    <>
      <aside className="sticky top-0 row-span-2 hidden h-dvh flex-col border-r bg-card px-3 py-6 md:flex xl:px-5">
        <Link
          href={overviewHref}
          aria-label="PasaOrder workspace"
          className="mx-auto flex min-h-11 items-center gap-3 xl:mx-0 xl:px-2"
        >
          <span
            className="grid size-10 shrink-0 place-items-center rounded-xl bg-auth-lime text-2xl font-bold tracking-tight text-auth-forest"
            aria-hidden="true"
          >
            p.
          </span>
          <span className="hidden text-xl font-bold tracking-tight xl:block">
            PasaOrder
          </span>
        </Link>
        <p className="mt-10 mb-3 hidden px-3 text-xs font-medium tracking-[.1em] text-muted-foreground uppercase xl:block">
          {selectedStore?.name ?? "Workspace"}
        </p>
        <nav aria-label="Store workspace" className="mt-8 space-y-2 xl:mt-0">
          {links.map(({ href, label, icon: Icon, active, count }) => (
            <Link
              key={label}
              href={href}
              aria-current={active ? "location" : undefined}
              aria-label={
                count
                  ? `${label}, ${count} ${count === 1 ? "conversation" : "conversations"} need review`
                  : undefined
              }
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs transition-colors xl:min-h-12 xl:flex-row xl:justify-start xl:gap-3 xl:px-3 xl:text-sm",
                active
                  ? "bg-secondary font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span className="relative grid size-5 shrink-0 place-items-center">
                <Icon className="size-5" aria-hidden="true" />
                {count > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-700 px-1 text-[10px] font-bold leading-none tabular-nums text-primary-foreground xl:hidden"
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </span>
              {label}
              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="ml-auto hidden h-6 min-w-6 items-center justify-center rounded-full bg-red-700 px-1.5 text-xs font-semibold tabular-nums text-primary-foreground xl:inline-flex"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <p className="mt-auto hidden px-3 pt-6 text-[13px] leading-relaxed text-muted-foreground xl:block">
          Your store.
          <br />
          Your way.
        </p>
      </aside>
      <header className="sticky top-0 z-30 flex h-[var(--workspace-top)] items-center justify-between gap-3 border-b bg-card px-4 pt-[env(safe-area-inset-top)] sm:px-5 md:col-start-2 md:px-8 lg:px-10">
        <details ref={storeMenu} className="group relative min-w-0">
          <summary
            aria-label={`Switch store. Current store: ${selectedStore?.name ?? "none selected"}`}
            className="flex min-h-11 max-w-[min(65vw,22rem)] cursor-pointer list-none items-center gap-2 rounded-xl px-2 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 [&::-webkit-details-marker]:hidden"
          >
            <Store
              className="size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span className="truncate text-sm font-semibold sm:text-base">
              {selectedStore?.name ?? "Choose a store"}
            </span>
            <ChevronDown
              className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="absolute top-full left-0 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border bg-card shadow-lg">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Your stores</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Switch workspace or choose your sign-in default.
              </p>
            </div>
            <div className="max-h-[min(55dvh,24rem)] overflow-y-auto p-2">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center gap-2 rounded-xl px-2 hover:bg-muted"
                >
                  <Link
                    href={`/dashboard/stores/${store.id}/overview`}
                    onClick={() => {
                      if (storeMenu.current) storeMenu.current.open = false;
                    }}
                    aria-current={
                      store.id === selectedStore?.id ? "page" : undefined
                    }
                    className="flex min-h-12 min-w-0 flex-1 items-center gap-2 text-sm"
                  >
                    <span className="truncate font-medium">{store.name}</span>
                    {store.isDefault && (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        Default
                      </span>
                    )}
                  </Link>
                  {!store.isDefault && (
                    <button
                      type="button"
                      onClick={() => chooseDefault(store.id)}
                      disabled={pending}
                      className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-medium text-primary hover:bg-background focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
                    >
                      {pending ? "Saving…" : "Make default"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {message && (
              <p
                role="status"
                className="px-4 pb-2 text-xs text-muted-foreground"
              >
                {message}
              </p>
            )}
            <div className="border-t p-2">
              <Link
                href="/dashboard/new"
                onClick={() => {
                  if (storeMenu.current) storeMenu.current.open = false;
                }}
                className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium text-primary hover:bg-muted"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add a store
              </Link>
            </div>
          </div>
        </details>
        <details ref={account} className="group relative shrink-0">
          <summary
            aria-label="Account menu"
            className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full p-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden"
          >
            <span className="hidden max-w-44 truncate text-sm font-medium sm:block">
              {name}
            </span>
            <span
              className="grid size-10 place-items-center rounded-full border bg-secondary text-sm font-semibold text-primary"
              aria-hidden="true"
            >
              {Array.from(name.trim())[0]?.toUpperCase() || "P"}
            </span>
            <ChevronDown
              className="hidden size-4 text-muted-foreground sm:block"
              aria-hidden="true"
            />
          </summary>
          <div className="absolute top-full right-0 mt-3 w-[min(288px,calc(100vw-2.5rem))] rounded-2xl border bg-card p-5 shadow-lg">
            <p className="break-words text-base font-semibold">{name}</p>
            <p className="mt-1 break-all text-[13px] text-muted-foreground">
              {email}
            </p>
            <div className="mt-5 border-t pt-4">
              <LogoutButton />
            </div>
          </div>
        </details>
      </header>
      <nav
        aria-label="Store workspace"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card pt-2 pl-[max(.5rem,env(safe-area-inset-left))] pr-[max(.5rem,env(safe-area-inset-right))] pb-[max(.5rem,env(safe-area-inset-bottom))] md:hidden"
      >
        {links.map(({ href, label, icon: Icon, active, count }) => (
          <Link
            key={label}
            href={href}
            aria-current={active ? "location" : undefined}
            aria-label={
              count
                ? `${label}, ${count} ${count === 1 ? "conversation" : "conversations"} need review`
                : undefined
            }
            className={cn(
              "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-xs font-medium",
              active ? "text-primary" : "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "relative flex h-7 w-14 items-center justify-center rounded-full",
                active && "bg-secondary",
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              {count > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none tabular-nums text-primary-foreground"
                >
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
