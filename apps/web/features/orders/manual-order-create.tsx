"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { Check, Minus, Plus, Search, Trash2, WifiOff, X } from "lucide-react";
import type { Catalog, OrderType, PaymentMethod } from "@pasaorder/types";
import { createManualOrderSchema } from "@pasaorder/validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { peso } from "@/features/catalog/color";
import { createManualOrder, loadManualOrderCatalog } from "./actions";
import {
  captureManualOrder,
  manualStorageKey,
  manualSubtotal,
  restoreManualOrders,
  syncManualOrderPass,
  type ManualPayload,
  type SavedManualOrder,
} from "./manual-order-queue";

type Line = ManualPayload["items"][number] & { name: string };
type Receipt = { id: string; text: string; orderId?: string };
const control =
  "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ManualOrderCreate({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [freshMenu, setFreshMenu] = useState<{
    source: Catalog;
    value: Catalog;
  } | null>(null);
  const menu = freshMenu?.source === catalog ? freshMenu.value : catalog;
  const { store } = menu;
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [queue, setQueue] = useState<SavedManualOrder[]>([]);
  const queueRef = useRef<SavedManualOrder[]>([]);
  const running = useRef(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [discardId, setDiscardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pendingChoice, setPendingChoice] = useState<
    (Line & { category: string }) | null
  >(null);
  const [pendingAddOns, setPendingAddOns] = useState<
    { groupId: string; optionId: string }[]
  >([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<OrderType>(
    store.orderTypes[0] ?? "PICKUP",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    store.paymentMethods[0] ?? "CASH",
  );
  const [tableNumber, setTableNumber] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formKey = useRef<string | null>(null);
  const submitted = useRef(false);
  const products = useMemo(
    () => menu.categories.flatMap((category) => category.items),
    [menu],
  );
  const choices = useMemo(
    () =>
      menu.categories
        .flatMap((category) =>
          category.items
            .filter((product) => product.isAvailable)
            .flatMap((product) =>
              (product.variants.length ? product.variants : [null]).map(
                (variant) => ({
                  productId: product.id,
                  variantId: variant?.id ?? null,
                  quantity: 1,
                  expectedUnitPrice: variant?.price ?? product.price,
                  name: product.name + (variant ? ` · ${variant.label}` : ""),
                  category: category.name,
                }),
              ),
            ),
        )
        .filter((choice) =>
          `${choice.name} ${choice.category}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        ),
    [menu, search],
  );
  const priceFor = (line: Line) => {
    const product = products.find((item) => item.id === line.productId);
    if (!product?.isAvailable) return null;
    const base = product.variants.length
      ? (product.variants.find((variant) => variant.id === line.variantId)
          ?.price ?? null)
      : line.variantId
        ? null
        : product.price;
    if (base === null) return null;
    const selectedAddOns = line.addOns ?? [];
    for (const group of product.addOnGroups) {
      const selectedInGroup = selectedAddOns.filter(
        (choice) => choice.groupId === group.id,
      );
      if (
        (group.required && selectedInGroup.length === 0) ||
        (group.selection === "SINGLE" && selectedInGroup.length > 1)
      )
        return null;
    }
    const extra = (line.addOns ?? []).reduce((sum, selected) => {
      const option = product.addOnGroups
        .find((group) => group.id === selected.groupId)
        ?.options.find((item) => item.id === selected.optionId);
      return option ? sum + Math.round(Number(option.price) * 100) : Number.NaN;
    }, 0);
    if (!Number.isFinite(extra)) return null;
    return ((Math.round(Number(base) * 100) + extra) / 100).toFixed(2);
  };
  const conflicts = lines.some(
    (line) =>
      priceFor(line) === null ||
      line.expectedUnitPrice === undefined ||
      Number(priceFor(line)) !== Number(line.expectedUnitPrice),
  );
  const total = lines.reduce(
    (sum, line) =>
      sum +
      Math.round(Number(line.expectedUnitPrice ?? 0) * 100) * line.quantity,
    0,
  );

  const persist = useCallback(
    (change: (current: SavedManualOrder[]) => SavedManualOrder[]) => {
      // Read before each write so an update doesn't overwrite another tab's queue.
      const next = change(
        restoreManualOrders(
          localStorage.getItem(manualStorageKey(catalog.store.id)),
        ),
      );
      localStorage.setItem(
        manualStorageKey(catalog.store.id),
        JSON.stringify(next),
      );
      queueRef.current = next;
      setQueue(next);
    },
    [catalog.store.id],
  );

  useEffect(() => {
    const read = () => {
      setOnline(navigator.onLine);
      try {
        const saved = restoreManualOrders(
          localStorage.getItem(manualStorageKey(catalog.store.id)),
        );
        queueRef.current = saved;
        setQueue(saved);
        setLoaded(true);
      } catch {
        setStorageError(
          "Saved orders couldn’t be read. Keep this browser’s data and retry after checking device storage.",
        );
      }
    };
    const connection = () => setOnline(navigator.onLine);
    read();
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
      window.removeEventListener("storage", read);
    };
  }, [catalog.store.id]);

  useEffect(() => {
    if (
      !loaded ||
      !online ||
      storageError ||
      running.current ||
      !queue.some((entry) => entry.state === "waiting")
    )
      return;
    running.current = true;
    setBusy(true);
    startTransition(async () => {
      const work = async () => {
        const entries = restoreManualOrders(
          localStorage.getItem(manualStorageKey(catalog.store.id)),
        );
        await syncManualOrderPass(
          entries,
          async (payload) => {
            // Persist the uncertain state before dispatch. A reload or another
            // tab must retry this key, never edit or discard an in-flight order.
            const saved = restoreManualOrders(
              localStorage.getItem(manualStorageKey(catalog.store.id)),
            ).find(
              (entry) =>
                entry.id === payload.idempotencyKey &&
                entry.state === "waiting",
            );
            if (!saved) throw new Error("Saved order changed before sending.");
            persist((current) =>
              current.map((entry) =>
                entry.id === saved.id
                  ? {
                      ...entry,
                      state: "retry",
                      error:
                        "Checking whether this order reached the store. Retry this saved order if the connection was interrupted.",
                    }
                  : entry,
              ),
            );
            return createManualOrder(catalog.store.id, saved.payload);
          },
          (entry, result) => {
            persist((current) =>
              result.success
                ? current.filter((item) => item.id !== entry.id)
                : current.map((item) =>
                    item.id === entry.id
                      ? {
                          ...item,
                          state: result.reviewable ? "review" : "retry",
                          error: result.message,
                        }
                      : item,
                  ),
            );
            if (result.success) {
              setReceipts((current) =>
                [
                  ...current.filter((item) => item.id !== entry.id),
                  {
                    id: entry.id,
                    text: `Order #${result.orderId} created for ${entry.payload.customerName} · ${peso((manualSubtotal(entry.payload) / 100).toFixed(2))}`,
                    orderId: result.orderId,
                  },
                ].slice(-5),
              );
              router.refresh();
            }
          },
          () => navigator.onLine,
        );
      };
      try {
        if (navigator.locks)
          await navigator.locks.request(
            manualStorageKey(catalog.store.id),
            work,
          );
        else await work();
      } catch {
        setStorageError(
          "Couldn’t update saved orders on this device. Keep this page open and check device storage before retrying.",
        );
      } finally {
        running.current = false;
        setBusy(false);
      }
    });
  }, [
    queue,
    online,
    loaded,
    storageError,
    persist,
    router,
    catalog.store.id,
    busy,
  ]);

  function reset() {
    setLines([]);
    setSearch("");
    setPendingChoice(null);
    setPendingAddOns([]);
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setTableNumber("");
    setDeliveryAddress("");
    setMessage("");
    setErrors({});
    setEditing(null);
    formKey.current = null;
    submitted.current = false;
  }
  function newOrder() {
    reset();
    setOpen(true);
  }
  function updateQuantity(index: number, quantity: number) {
    setLines((current) =>
      current.map((line, position) =>
        position === index
          ? { ...line, quantity: Math.max(1, Math.min(100, quantity)) }
          : line,
      ),
    );
  }
  function addLine(choice: Line) {
    setLines((current) => {
      const index = current.findIndex(
        (line) =>
          line.productId === choice.productId &&
          line.variantId === choice.variantId &&
          JSON.stringify(line.addOns ?? []) ===
            JSON.stringify(choice.addOns ?? []),
      );
      if (index >= 0)
        return current.map((line, position) =>
          position === index
            ? { ...line, quantity: Math.min(100, line.quantity + 1) }
            : line,
        );
      return current.length >= 100 ? current : [...current, choice];
    });
    setMessage("");
  }
  function chooseManualProduct(choice: Line & { category: string }) {
    const product = products.find((item) => item.id === choice.productId);
    if (!product?.addOnGroups.length) {
      addLine({ ...choice, addOns: [] });
      return;
    }
    setPendingChoice(choice);
    setPendingAddOns([]);
  }
  function queueChange(
    change: (current: SavedManualOrder[]) => SavedManualOrder[],
  ) {
    try {
      persist(change);
      return true;
    } catch {
      setStorageError(
        "Couldn’t save changes on this device. Your order has not been discarded. Check device storage.",
      );
      return false;
    }
  }
  function review(entry: SavedManualOrder) {
    if (busy || entry.state !== "review") return;
    setRefreshing(true);
    startTransition(async () => {
      try {
        const result = await loadManualOrderCatalog(store.id);
        if (!result.success) {
          setReceipts((current) => [
            ...current.slice(-4),
            { id: crypto.randomUUID(), text: result.message },
          ]);
          return;
        }
        setFreshMenu({ source: catalog, value: result.catalog });
        reset();
        setEditing(entry.id);
        formKey.current = entry.id;
        const input = entry.payload;
        const all = result.catalog.categories.flatMap(
          (category) => category.items,
        );
        setLines(
          input.items.map((line, index) => {
            const product = all.find((item) => item.id === line.productId);
            const variant = product?.variants.find(
              (item) => item.id === line.variantId,
            );
            return {
              ...line,
              name:
                entry.names[index] ??
                (product
                  ? product.name + (variant ? ` · ${variant.label}` : "")
                  : "Unavailable item"),
            };
          }),
        );
        setCustomerName(input.customerName);
        setCustomerPhone(input.customerPhone ?? "");
        setOrderType(input.orderType);
        setPaymentMethod(input.paymentMethod);
        setTableNumber(input.tableNumber ?? "");
        setDeliveryAddress(input.deliveryAddress ?? "");
        setNotes(input.notes ?? "");
        setOpen(true);
      } catch {
        setReceipts((current) => [
          ...current.slice(-4),
          {
            id: crypto.randomUUID(),
            text: "Couldn’t load the latest catalog. Reconnect and try Review order again.",
          },
        ]);
      } finally {
        setRefreshing(false);
      }
    });
  }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current || conflicts || !loaded || storageError) return;
    formKey.current ??= crypto.randomUUID();
    const parsed = createManualOrderSchema.safeParse({
      idempotencyKey: formKey.current,
      customerName:
        customerName.trim() || (orderType !== "DELIVERY" ? "Walk-in" : ""),
      customerPhone: customerPhone.trim() || undefined,
      orderType,
      paymentMethod,
      tableNumber:
        orderType === "DINE_IN" ? tableNumber.trim() || undefined : undefined,
      deliveryAddress:
        orderType === "DELIVERY" ? deliveryAddress.trim() : undefined,
      notes: notes.trim() || undefined,
      items: lines.map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: line.quantity,
        addOns: line.addOns ?? [],
        expectedUnitPrice: line.expectedUnitPrice,
      })),
    });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        nextErrors[String(issue.path[0])] ??= issue.message;
      setErrors(nextErrors);
      setMessage("Check the highlighted order details.");
      return;
    }
    if (
      !store.orderTypes.includes(orderType) ||
      !store.paymentMethods.includes(paymentMethod)
    ) {
      setMessage("Choose an available order type and payment method.");
      return;
    }
    const entry = captureManualOrder(
      parsed.data,
      lines.map((line) => line.name),
      queueRef.current.find((item) => item.id === editing),
    );
    submitted.current = true;
    const saved = queueChange((current) => {
      if (
        editing &&
        !current.some((item) => item.id === editing && item.state === "review")
      )
        throw new Error("This saved order has already changed.");
      return [...current.filter((item) => item.id !== entry.id), entry];
    });
    if (!saved) {
      submitted.current = false;
      setMessage(
        "The order could not be saved on this device. Your form is still here.",
      );
      return;
    }
    setReceipts((current) =>
      [
        ...current.filter((item) => item.id !== entry.id),
        {
          id: entry.id,
          text: `${entry.payload.customerName} · ${peso((manualSubtotal(entry.payload) / 100).toFixed(2))} saved on this device. ${navigator.onLine ? "Sending to New orders…" : "Waiting for connection."}`,
        },
      ].slice(-5),
    );
    reset();
    setOpen(false);
  }
  const fieldError = (field: string) =>
    errors[field] ? (
      <p id={`manual-${field}-error`} className="mt-1 text-sm text-destructive">
        {errors[field]}
      </p>
    ) : null;

  return (
    <div className="mb-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {online
            ? "Walk-in or phone order? Add it here."
            : "You’re offline. Keep this page open to record orders."}
        </p>
        <Button
          onClick={newOrder}
          disabled={!loaded || !!storageError || refreshing}
          className="min-h-11 rounded-xl"
        >
          <Plus aria-hidden="true" />
          Create order
        </Button>
      </div>
      <div role="status" aria-live="polite" className="space-y-2">
        {receipts.map((receipt) => (
          <div
            key={receipt.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-secondary px-4 py-3 text-sm"
          >
            <Check className="size-4 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">{receipt.text}</span>
            {receipt.orderId && (
              <a
                className="inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-4"
                href={`/dashboard/stores/${store.id}/orders?queue=NEW&order=${receipt.orderId}`}
              >
                View order #{receipt.orderId}
              </a>
            )}
            <Button
              variant="ghost"
              className="size-11"
              onClick={() =>
                setReceipts((current) =>
                  current.filter((item) => item.id !== receipt.id),
                )
              }
              aria-label="Dismiss notification"
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
      {storageError && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-3 text-sm text-destructive"
        >
          {storageError}
        </p>
      )}
      {queue.length > 0 && (
        <section
          aria-label="Saved manual orders"
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              Saved on this device{" "}
              <span className="text-muted-foreground">({queue.length})</span>
            </h2>
            <span className="text-sm text-muted-foreground">
              {busy
                ? "Sending orders…"
                : online
                  ? "Orders needing a retry stay saved"
                  : "Waiting for connection"}
            </span>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {queue.map((entry) => (
              <li key={entry.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {entry.payload.customerName} ·{" "}
                      {peso((manualSubtotal(entry.payload) / 100).toFixed(2))}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {new Date(entry.savedAt).toLocaleString("en-PH", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      ·{" "}
                      {entry.payload.items.reduce(
                        (sum, item) => sum + item.quantity,
                        0,
                      )}{" "}
                      items
                    </p>
                  </div>
                  <span className="text-sm font-medium">
                    {entry.state === "review"
                      ? "Needs review"
                      : entry.state === "retry"
                        ? "Retry connection"
                        : busy
                          ? "Sending / waiting"
                          : "Waiting"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.names.length
                    ? entry.names
                        .map(
                          (name, index) =>
                            `${entry.payload.items[index]?.quantity ?? 1} × ${name}`,
                        )
                        .join(", ")
                    : "Open review to see the saved items."}
                </p>
                {entry.error && (
                  <p className="mt-2 text-sm text-destructive">{entry.error}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {entry.state === "review" && (
                    <Button
                      variant="outline"
                      className="min-h-11"
                      disabled={busy || refreshing || !online}
                      onClick={() => review(entry)}
                    >
                      {refreshing ? "Loading catalog…" : "Review order"}
                    </Button>
                  )}
                  {entry.state === "retry" && (
                    <>
                      <Button
                        variant="outline"
                        className="min-h-11"
                        disabled={busy || !online}
                        onClick={() =>
                          queueChange((current) =>
                            current.map((item) =>
                              item.id === entry.id
                                ? {
                                    ...item,
                                    state: "waiting",
                                    error: undefined,
                                  }
                                : item,
                            ),
                          )
                        }
                      >
                        Retry saved order
                      </Button>
                      <p className="self-center text-sm text-muted-foreground">
                        Retry checks for an existing order before creating one.
                      </p>
                    </>
                  )}
                  {entry.state !== "retry" &&
                    (discardId === entry.id ? (
                      <>
                        <span className="self-center text-sm">
                          Discard this saved order?
                        </span>
                        <Button
                          variant="destructive"
                          className="min-h-11"
                          disabled={busy}
                          onClick={() => {
                            if (
                              queueChange((current) =>
                                current.filter((item) => item.id !== entry.id),
                              )
                            ) {
                              setDiscardId(null);
                              setReceipts((current) =>
                                current.filter((item) => item.id !== entry.id),
                              );
                            }
                          }}
                        >
                          Discard order
                        </Button>
                        <Button
                          variant="ghost"
                          className="min-h-11"
                          onClick={() => setDiscardId(null)}
                        >
                          Keep order
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        className="min-h-11"
                        disabled={busy}
                        onClick={() => setDiscardId(entry.id)}
                      >
                        Discard
                      </Button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="merchant-theme fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border border-border bg-background text-foreground shadow-xl outline-none sm:inset-x-auto sm:top-1/2 sm:left-1/2 sm:bottom-auto sm:w-[min(720px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-5">
              <div>
                <Dialog.Title className="text-xl font-semibold">
                  {editing ? "Review saved order" : "Create an order"}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {store.name} ·{" "}
                  {editing
                    ? "Check current prices and replace unavailable items before sending."
                    : "Add items, check the details, and send to New orders."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  className="size-11"
                  aria-label="Close order form"
                >
                  <X />
                </Button>
              </Dialog.Close>
            </header>
            <form
              onSubmit={submit}
              noValidate
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
                {!online && (
                  <p className="flex items-start gap-2 text-sm text-muted-foreground">
                    <WifiOff className="size-4 shrink-0" aria-hidden="true" />
                    Orders are saved in this browser and sent when connection
                    returns. Keep this page open; reloading offline cannot
                    reopen the workspace.
                  </p>
                )}
                <fieldset className="space-y-3">
                  <legend className="mb-3 font-semibold">Add items</legend>
                  <Label htmlFor="manual-search" className="sr-only">
                    Search products, sizes, or categories
                  </Label>
                  <div className="relative">
                    <Search
                      className="absolute top-3.5 left-3 size-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      id="manual-search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search products, sizes, or categories"
                      className="min-h-11 pl-9 text-base md:text-base"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-xl border border-border">
                    {choices.length ? (
                      choices.map((choice) => (
                        <button
                          type="button"
                          key={`${choice.productId}:${choice.variantId}`}
                          className="flex min-h-14 w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-secondary focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                          onClick={() => chooseManualProduct(choice)}
                          disabled={
                            lines.length >= 100 &&
                            !lines.some(
                              (line) =>
                                line.productId === choice.productId &&
                                line.variantId === choice.variantId,
                            )
                          }
                          aria-label={`Add ${choice.name}`}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block break-words text-sm font-medium">
                              {choice.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {choice.category}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums">
                            {peso(choice.expectedUnitPrice)}
                          </span>
                          <Plus
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                        </button>
                      ))
                    ) : (
                      <p className="p-4 text-sm text-muted-foreground">
                        {search
                          ? "No matching products. Try another name or category."
                          : "No available products. Add or enable a product in Catalog, then reopen Orders."}
                      </p>
                    )}
                  </div>
                  {pendingChoice &&
                    (() => {
                      const product = products.find(
                        (item) => item.id === pendingChoice.productId,
                      )!;
                      return (
                        <section
                          className="space-y-3 rounded-xl border border-primary/30 bg-secondary/40 p-3"
                          aria-label="Configure product add-ons"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="font-semibold">
                              Options for {pendingChoice.name}
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setPendingChoice(null)}
                              aria-label="Close add-on options"
                            >
                              <X />
                            </Button>
                          </div>
                          {product.addOnGroups.map((group) => (
                            <fieldset key={group.id} className="space-y-1">
                              <legend className="mb-1 text-sm font-medium">
                                {group.name}
                                {group.required ? " · Required" : " · Optional"}
                              </legend>
                              {group.selection === "SINGLE" &&
                                !group.required && (
                                  <label className="flex min-h-10 items-center gap-2 text-sm">
                                    <input
                                      type="radio"
                                      name={`manual-addon-${group.id}`}
                                      checked={
                                        !pendingAddOns.some(
                                          (choice) =>
                                            choice.groupId === group.id,
                                        )
                                      }
                                      onChange={() =>
                                        setPendingAddOns((current) =>
                                          current.filter(
                                            (choice) =>
                                              choice.groupId !== group.id,
                                          ),
                                        )
                                      }
                                    />
                                    <span>No thanks</span>
                                  </label>
                                )}
                              {group.options.map((option) => {
                                const selected = pendingAddOns.some(
                                  (choice) =>
                                    choice.groupId === group.id &&
                                    choice.optionId === option.id,
                                );
                                return (
                                  <label
                                    key={option.id}
                                    className="flex min-h-10 items-center gap-2 text-sm"
                                  >
                                    <input
                                      type={
                                        group.selection === "SINGLE"
                                          ? "radio"
                                          : "checkbox"
                                      }
                                      name={`manual-addon-${group.id}`}
                                      checked={selected}
                                      onChange={() =>
                                        setPendingAddOns((current) =>
                                          selected
                                            ? current.filter(
                                                (choice) =>
                                                  !(
                                                    choice.groupId ===
                                                      group.id &&
                                                    choice.optionId ===
                                                      option.id
                                                  ),
                                              )
                                            : [
                                                ...current.filter(
                                                  (choice) =>
                                                    choice.groupId !==
                                                      group.id ||
                                                    group.selection ===
                                                      "MULTIPLE",
                                                ),
                                                {
                                                  groupId: group.id,
                                                  optionId: option.id,
                                                },
                                              ],
                                        )
                                      }
                                    />{" "}
                                    <span className="flex-1">
                                      {option.name}
                                    </span>
                                    <span>+{peso(option.price)}</span>
                                  </label>
                                );
                              })}
                            </fieldset>
                          ))}
                          <Button
                            type="button"
                            className="min-h-11 w-full"
                            disabled={product.addOnGroups.some(
                              (group) =>
                                group.required &&
                                !pendingAddOns.some(
                                  (choice) => choice.groupId === group.id,
                                ),
                            )}
                            onClick={() => {
                              const labels = pendingAddOns
                                .map(
                                  (selected) =>
                                    product.addOnGroups
                                      .find(
                                        (group) =>
                                          group.id === selected.groupId,
                                      )
                                      ?.options.find(
                                        (item) => item.id === selected.optionId,
                                      )?.name,
                                )
                                .filter((label): label is string => !!label);
                              const extra = pendingAddOns.reduce(
                                (sum, selected) => {
                                  const option = product.addOnGroups
                                    .find(
                                      (group) => group.id === selected.groupId,
                                    )
                                    ?.options.find(
                                      (item) => item.id === selected.optionId,
                                    );
                                  return (
                                    sum +
                                    (option
                                      ? Math.round(Number(option.price) * 100)
                                      : 0)
                                  );
                                },
                                0,
                              );
                              addLine({
                                ...pendingChoice,
                                name: labels.length
                                  ? `${pendingChoice.name} · ${labels.join(", ")}`
                                  : pendingChoice.name,
                                addOns: pendingAddOns,
                                expectedUnitPrice: (
                                  (Math.round(
                                    Number(pendingChoice.expectedUnitPrice) *
                                      100,
                                  ) +
                                    extra) /
                                  100
                                ).toFixed(2),
                              });
                              setPendingChoice(null);
                            }}
                          >
                            Add item
                          </Button>
                        </section>
                      );
                    })()}
                </fieldset>
                <section aria-label="Order items">
                  <h3 className="font-semibold">
                    Order items{" "}
                    <span className="text-muted-foreground">
                      ({lines.length})
                    </span>
                  </h3>
                  {!lines.length && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Choose products above to start this order.
                    </p>
                  )}
                  {fieldError("items")}
                  <ul className="mt-2 divide-y divide-border">
                    {lines.map((line, index) => {
                      const price = priceFor(line);
                      const changed =
                        price !== null &&
                        (line.expectedUnitPrice === undefined ||
                          Number(price) !== Number(line.expectedUnitPrice));
                      return (
                        <li
                          key={`${line.productId}:${line.variantId}`}
                          className="space-y-2 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-medium">
                                {line.name}
                              </p>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {line.expectedUnitPrice === undefined
                                  ? "Saved price unavailable"
                                  : `${peso(line.expectedUnitPrice)} each`}
                              </p>
                            </div>
                            <span className="shrink-0 tabular-nums">
                              {peso(
                                (
                                  (Math.round(
                                    Number(line.expectedUnitPrice ?? 0) * 100,
                                  ) *
                                    line.quantity) /
                                  100
                                ).toFixed(2),
                              )}
                            </span>
                          </div>
                          {price === null && (
                            <p className="text-sm text-destructive">
                              This item or option is no longer available. Remove
                              it and choose a replacement.
                            </p>
                          )}
                          {changed && (
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <span>Current price: {peso(price!)}</span>
                              <Button
                                type="button"
                                variant="outline"
                                className="min-h-11"
                                onClick={() =>
                                  setLines((current) =>
                                    current.map((item, position) =>
                                      position === index
                                        ? { ...item, expectedUnitPrice: price! }
                                        : item,
                                    ),
                                  )
                                }
                              >
                                Accept current price
                              </Button>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              className="size-11"
                              aria-label={`Decrease ${line.name}`}
                              disabled={line.quantity <= 1}
                              onClick={() =>
                                updateQuantity(index, line.quantity - 1)
                              }
                            >
                              <Minus />
                            </Button>
                            <Input
                              aria-label={`Quantity for ${line.name}`}
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={100}
                              value={line.quantity}
                              onChange={(event) => {
                                const value = Number(event.target.value);
                                if (Number.isInteger(value))
                                  updateQuantity(index, value);
                              }}
                              className="h-11 w-16 text-center text-base md:text-base"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              className="size-11"
                              aria-label={`Increase ${line.name}`}
                              disabled={line.quantity >= 100}
                              onClick={() =>
                                updateQuantity(index, line.quantity + 1)
                              }
                            >
                              <Plus />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              className="ml-auto size-11"
                              aria-label={`Remove ${line.name}`}
                              onClick={() =>
                                setLines((current) =>
                                  current.filter(
                                    (_, position) => position !== index,
                                  ),
                                )
                              }
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
                <fieldset className="space-y-4">
                  <legend className="mb-3 font-semibold">Order details</legend>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-type">Order type</Label>
                      <select
                        id="manual-type"
                        className={control}
                        value={orderType}
                        onChange={(event) =>
                          setOrderType(event.target.value as OrderType)
                        }
                      >
                        {!store.orderTypes.includes(orderType) && (
                          <option value={orderType} disabled>
                            Previously selected type is unavailable
                          </option>
                        )}
                        {store.orderTypes.map((type) => (
                          <option key={type} value={type}>
                            {type === "DINE_IN"
                              ? "Dine in"
                              : type === "PICKUP"
                                ? "Takeaway"
                                : "Delivery"}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-payment">Payment method</Label>
                      <select
                        id="manual-payment"
                        className={control}
                        value={paymentMethod}
                        onChange={(event) =>
                          setPaymentMethod(event.target.value as PaymentMethod)
                        }
                      >
                        {!store.paymentMethods.includes(paymentMethod) && (
                          <option value={paymentMethod} disabled>
                            Previously selected method is unavailable
                          </option>
                        )}
                        {store.paymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method === "GCASH" ? "GCash" : "Cash"}
                          </option>
                        ))}
                      </select>
                      <p className="text-sm text-muted-foreground">
                        Starts unpaid. Mark paid after checking payment.
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="manual-name">
                        Customer name{" "}
                        {orderType !== "DELIVERY" && (
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        )}
                      </Label>
                      <Input
                        id="manual-name"
                        value={customerName}
                        placeholder="Enter customer name"
                        onChange={(event) =>
                          setCustomerName(event.target.value)
                        }
                        maxLength={120}
                        aria-invalid={!!errors.customerName}
                        aria-describedby={
                          errors.customerName
                            ? "manual-customerName-error"
                            : undefined
                        }
                        className="min-h-11 text-base md:text-base"
                      />
                      {fieldError("customerName")}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-phone">
                        Mobile number{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="manual-phone"
                        type="tel"
                        value={customerPhone}
                        onChange={(event) =>
                          setCustomerPhone(event.target.value)
                        }
                        maxLength={40}
                        aria-invalid={!!errors.customerPhone}
                        aria-describedby={
                          errors.customerPhone
                            ? "manual-customerPhone-error"
                            : undefined
                        }
                        className="min-h-11 text-base md:text-base"
                      />
                      {fieldError("customerPhone")}
                    </div>
                  </div>
                  {orderType === "DINE_IN" && (
                    <div className="space-y-2">
                      <Label htmlFor="manual-table">
                        Table number{" "}
                        <span className="font-normal text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="manual-table"
                        value={tableNumber}
                        onChange={(event) => setTableNumber(event.target.value)}
                        maxLength={40}
                        className="min-h-11 text-base md:text-base"
                      />
                    </div>
                  )}
                  {orderType === "DELIVERY" && (
                    <div className="space-y-2">
                      <Label htmlFor="manual-address">Delivery address</Label>
                      <Input
                        id="manual-address"
                        value={deliveryAddress}
                        onChange={(event) =>
                          setDeliveryAddress(event.target.value)
                        }
                        maxLength={500}
                        aria-invalid={!!errors.deliveryAddress}
                        aria-describedby={
                          errors.deliveryAddress
                            ? "manual-deliveryAddress-error"
                            : undefined
                        }
                        className="min-h-11 text-base md:text-base"
                      />
                      {fieldError("deliveryAddress")}
                      <p className="text-sm text-muted-foreground">
                        Set the delivery fee when confirming the order.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="manual-notes">
                      Order note{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <textarea
                      id="manual-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      maxLength={500}
                      rows={2}
                      className={`${control} py-2`}
                    />
                  </div>
                </fieldset>
              </div>
              <footer className="shrink-0 space-y-2 border-t border-border bg-background px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {message && (
                  <p role="alert" className="text-sm text-destructive">
                    {message}
                  </p>
                )}
                {conflicts && (
                  <p role="status" className="text-sm text-destructive">
                    Review changed prices or remove unavailable items above.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      {orderType === "DELIVERY"
                        ? "Subtotal · delivery fee later"
                        : "Subtotal"}
                    </p>
                    <p className="text-lg font-semibold tabular-nums">
                      {peso((total / 100).toFixed(2))}
                    </p>
                  </div>
                  <Button
                    type="submit"
                    className="min-h-11 rounded-xl"
                    disabled={
                      !loaded || !!storageError || conflicts || !lines.length
                    }
                  >
                    {editing
                      ? "Save reviewed order"
                      : online
                        ? "Create order"
                        : "Save offline order"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {online
                    ? "Sends to the New orders queue for confirmation."
                    : "Saved in this browser until you reconnect."}
                </p>
              </footer>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
