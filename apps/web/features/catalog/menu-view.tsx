"use client";

import {
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  Clock3,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Store,
  X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import {
  weekdays,
  type Catalog,
  type OrderType,
  type Product,
  type SelectedProductAddon,
  type Weekday,
} from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { CatalogImage } from "./catalog-image";
import { MenuCategories } from "./menu-categories";
import { accentInk, accentText, peso } from "./color";
import { formatQuantity, minimumQuantity, quantityLabel } from "./quantity";
import { CartCheckout } from "./cart-checkout";

import { useMenuRecovery } from "./use-menu-recovery";

function getLocalWeekday(): Weekday {
  return weekdays[(new Date().getDay() + 6) % 7];
}

function subscribeToLocalWeekday(onChange: () => void) {
  let timeout: number;
  const scheduleNextDay = () => {
    const now = new Date();
    const nextDay = new Date(now);
    nextDay.setHours(24, 0, 0, 0);
    timeout = window.setTimeout(() => {
      onChange();
      scheduleNextDay();
    }, nextDay.getTime() - now.getTime());
  };
  const refreshOnFocus = () => onChange();
  scheduleNextDay();
  window.addEventListener("focus", refreshOnFocus);
  return () => {
    window.clearTimeout(timeout);
    window.removeEventListener("focus", refreshOnFocus);
  };
}

function getServerWeekday(): null {
  return null;
}

function startingVariant(item: Product) {
  return item.variants[0]?.id ?? "";
}

function displayPrice(item: Product) {
  const perKilogram = item.quantityUnit === "KG" ? " / kg" : "";
  if (!item.variants.length) return `${peso(item.price)}${perKilogram}`;
  const lowest = item.variants.reduce(
    (price, variant) => Math.min(price, Number(variant.price)),
    Number(item.variants[0].price),
  );
  return `From ${peso(String(lowest))}${perKilogram}`;
}

function formatHour(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

const businessCategoryLabels = {
  FOOD_BEVERAGE: "Food & beverage",
  RETAIL: "Retail",
  BAKERY: "Bakery",
  CLOTHING: "Clothing & accessories",
  GIFTS_CRAFTS: "Gifts & crafts",
  SERVICES: "Services",
  OTHER: "Local business",
} as const;

export function MenuView({
  catalog,
  preview = false,
}: {
  catalog: Catalog;
  preview?: boolean;
}) {
  const storefrontCatalog = useMemo(
    () => ({
      ...catalog,
      store: { ...catalog.store, orderQuestions: [] },
      categories: catalog.categories.map((category) => ({
        ...category,
        items: category.items.map((item) => ({
          ...item,
          orderQuestions: [],
        })),
      })),
    }),
    [catalog],
  );
  const { store, categories } = storefrontCatalog;
  const visible = categories.filter((category) => category.items.length > 0);
  const hasHours = !!store.operatingHours?.length;
  const ink = accentInk(store.accentColor);
  const style = {
    "--store-accent": store.accentColor,
    "--store-accent-text": accentText(store.accentColor),
    "--store-accent-ink": ink,
    "--store-accent-soft": `color-mix(in srgb, ${ink} 6%, white)`,
    "--primary": store.accentColor,
    "--primary-foreground": accentText(store.accentColor),
    "--accent": `color-mix(in srgb, ${ink} 6%, white)`,
    "--accent-foreground": ink,
    "--ring": ink,
    colorScheme: "light",
    color: "#18251d",
  } as CSSProperties;
  const [selectedItem, setSelectedItem] = useState<Product | null>(null);
  const [orderType, setOrderType] = useState<OrderType>(
    store.orderTypes.includes("PICKUP")
      ? "PICKUP"
      : (store.orderTypes[0] ?? "PICKUP"),
  );
  const today = useSyncExternalStore(
    subscribeToLocalWeekday,
    getLocalWeekday,
    getServerWeekday,
  );
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedAddOns, setSelectedAddOns] = useState<SelectedProductAddon[]>(
    [],
  );
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const { cart, setCart, cartAdjusted, saved, online, refreshing } =
    useMenuRecovery(storefrontCatalog, preview);
  const [cartOpen, setCartOpen] = useState(false);
  const [addedMessage, setAddedMessage] = useState("");
  const selectedVariant =
    selectedItem?.variants.find(
      (variant) => variant.id === selectedVariantId,
    ) ?? null;
  const cartQuantity = cart.length;

  const todayHours = today
    ? store.operatingHours?.find((hours) => hours.day === today)
    : undefined;

  function openProduct(item: Product) {
    if (!item.isAvailable) return;
    setSelectedItem(item);
    setSelectedVariantId(startingVariant(item));
    setQuantity(item.quantityUnit === "KG" ? 0.5 : 1);
    setSelectedAddOns([]);
    setInstructions("");
    setAddedMessage("");
  }

  function addToCart() {
    if (!selectedItem) return;
    const variant =
      selectedItem.variants.find((option) => option.id === selectedVariantId) ??
      null;
    const addOns = selectedAddOns;
    const key = [
      selectedItem.id,
      variant?.id ?? "",
      instructions.trim(),
      ...addOns.map((choice) => `${choice.groupId}.${choice.optionId}`).sort(),
    ].join(":");
    setCart((current) => {
      const existing = current.find((line) => line.key === key);
      if (existing)
        return current.map((line) =>
          line.key === key
            ? {
                ...line,
                quantity: Math.min(
                  100,
                  Math.round((line.quantity + quantity) * 1000) / 1000,
                ),
              }
            : line,
        );
      return [
        ...current,
        {
          key,
          item: selectedItem,
          variant,
          addOns,
          answers: [],
          quantity,
          instructions: instructions.trim(),
        },
      ];
    });
    setAddedMessage(
      `${quantityLabel(quantity, selectedItem.quantityUnit)} ${selectedItem.name} added to cart.`,
    );
    setSelectedItem(null);
  }

  const addOnCents =
    selectedItem?.addOnGroups
      .flatMap((group) =>
        group.options.filter((option) =>
          selectedAddOns.some(
            (choice) =>
              choice.groupId === group.id && choice.optionId === option.id,
          ),
        ),
      )
      .reduce(
        (sum, option) => sum + Math.round(Number(option.price) * 100),
        0,
      ) ?? 0;
  const hasRequiredAddOns =
    selectedItem?.addOnGroups.every(
      (group) =>
        !group.required ||
        selectedAddOns.some((choice) => choice.groupId === group.id),
    ) ?? true;
  function toggleAddOn(
    groupId: string,
    optionId: string,
    selection: "SINGLE" | "MULTIPLE",
  ) {
    setSelectedAddOns((current) => {
      const exists = current.some(
        (choice) => choice.groupId === groupId && choice.optionId === optionId,
      );
      if (exists)
        return current.filter(
          (choice) =>
            !(choice.groupId === groupId && choice.optionId === optionId),
        );
      const otherGroups = current.filter(
        (choice) => choice.groupId !== groupId,
      );
      const sameGroup =
        selection === "MULTIPLE"
          ? current.filter((choice) => choice.groupId === groupId)
          : [];
      return [...otherGroups, ...sameGroup, { groupId, optionId }];
    });
  }

  return (
    <div
      style={style}
      className="min-h-dvh bg-[#f6f5ef] text-[#18251d] [color-scheme:light]"
    >
      {preview && (
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 bg-[#173d2c] px-5 py-4 text-sm text-white">
          <span>
            Owner preview ·{" "}
            {store.isPublished
              ? "Published catalog"
              : "This catalog is private"}
          </span>
          <Link
            href={`/dashboard/stores/${store.id}`}
            className="inline-flex min-h-8 items-center font-medium text-[#d6efa8] underline underline-offset-4"
          >
            Back to editor
          </Link>
        </div>
      )}
      {!preview &&
        (!online || refreshing || cartAdjusted || cart.length > 0) && (
          <div
            role="status"
            className="border-b border-[#d6dfd6] bg-white px-5 py-3 text-sm text-[#59685d] sm:px-8"
          >
            <p className="mx-auto max-w-5xl">
              {!online
                ? "You’re offline. You can keep editing this catalog’s cart. Reconnect to place your order."
                : refreshing
                  ? "Connection restored. Refreshing the catalog…"
                  : cartAdjusted
                    ? "Some saved items or options are no longer available and were removed. Please review your cart."
                    : saved
                      ? "Your cart is saved on this device for 7 days. Prices and availability are checked at checkout."
                      : "Keep this tab open to keep your cart. Saving on this device is unavailable."}
            </p>
          </div>
        )}
      <header
        id="store-profile"
        aria-labelledby="store-name"
        className={`${preview ? "scroll-mt-[var(--workspace-top)]" : "scroll-mt-0"} border-t-[5px] border-[var(--store-accent)]`}
      >
        <div
          className={`mx-auto max-w-6xl px-4 pb-6 sm:px-8 sm:pb-8 ${preview ? "pt-6" : "pt-[calc(1.25rem+env(safe-area-inset-top))]"}`}
        >
          <div className="overflow-hidden rounded-2xl border border-[#d6dfd6] bg-white">
            <div className="h-36 bg-[var(--store-accent-soft)] sm:h-48">
              {store.bannerUrl && (
                <CatalogImage
                  src={store.bannerUrl}
                  alt=""
                  className="size-full rounded-none"
                />
              )}
            </div>
            <div className="px-5 pb-5 sm:px-7 sm:pb-7">
              <div className="min-w-0">
                <div className="flex items-end gap-4">
                  <CatalogImage
                    src={store.logoUrl}
                    alt=""
                    store
                    className="relative -mt-8 size-20 rounded-2xl ring-4 ring-white sm:size-24"
                  />
                  <h1
                    id="store-name"
                    className="min-w-0 break-words pb-1 text-[28px] font-[650] leading-[1.2] tracking-[-0.025em]"
                  >
                    {store.name}
                  </h1>
                </div>
                <p className="mt-3 text-xs font-medium uppercase tracking-[0.08em] text-[#59685d]">
                  {businessCategoryLabels[store.businessCategory]}
                </p>
                {store.description && (
                  <p className="mt-3 break-words whitespace-pre-wrap text-sm leading-relaxed text-[#59685d]">
                    {store.description}
                  </p>
                )}
                {(store.address || store.contactPhone) && (
                  <div className="mt-5 flex flex-wrap items-start gap-x-8 gap-y-4 border-t border-[#e4e9e2] pt-5 text-xs">
                    {store.address && (
                      <p className="flex items-start gap-2 text-[#59685d]">
                        <MapPin
                          className="mt-0.5 size-4 shrink-0 text-[var(--store-accent-ink)]"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-[#18251d]">
                            Address
                          </span>
                          <span className="block break-words whitespace-pre-wrap">
                            {store.address}
                          </span>
                        </span>
                      </p>
                    )}
                    {store.contactPhone && (
                      <p className="flex items-start gap-2">
                        <Phone
                          className="mt-0.5 size-4 shrink-0 text-[var(--store-accent-ink)]"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-[#18251d]">
                            Phone
                          </span>
                          <a
                            href={`tel:${store.contactPhone.replace(/[^\d+]/g, "")}`}
                            className="block break-all font-medium text-[var(--store-accent-ink)] underline-offset-4 hover:underline focus-visible:underline"
                          >
                            {store.contactPhone}
                          </a>
                        </span>
                      </p>
                    )}
                    {hasHours && (
                      <div className="flex items-start gap-2">
                        <Clock3
                          className="size-4 text-[var(--store-accent-ink)]"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block font-medium text-[#18251d]">
                            Today&apos;s hours
                          </span>
                          <p className="tabular-nums text-[#59685d]">
                            {today
                              ? `${today[0].toUpperCase()}${today.slice(1)} · ${todayHours?.open ? `${formatHour(todayHours.opens)}–${formatHour(todayHours.closes)}${todayHours.closes < todayHours.opens ? " (next day)" : ""}` : "Closed"}`
                              : null}
                          </p>
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>
      {visible.length > 0 && (
        <nav
          aria-label="Catalog categories"
          className={`sticky ${preview ? "top-[var(--workspace-top)]" : "top-0"} z-10 border-y border-[#d6dfd6] bg-[#f6f5ef]`}
        >
          <MenuCategories
            categories={visible.map(({ id, name }) => ({ id, name }))}
          />
        </nav>
      )}
      {addedMessage && (
        <p role="status" className="sr-only" aria-live="polite">
          {addedMessage}
        </p>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-8 sm:py-12">
        {visible.length ? (
          <div className="space-y-12">
            {visible.map((category) => (
              <section
                key={category.id}
                id={`category-${category.id}`}
                className={preview ? "scroll-mt-44" : "scroll-mt-24"}
              >
                <div className="mb-4 flex items-baseline gap-3 sm:mb-5">
                  <h2 className="break-words text-[18px] font-semibold leading-[1.3] tracking-[-0.01em]">
                    {category.name}
                  </h2>
                  <span className="text-[13px] text-[#59685d]">
                    {category.items.length} items
                  </span>
                </div>
                <div className="grid items-stretch gap-3 md:grid-cols-2 md:gap-4">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openProduct(item)}
                      disabled={!item.isAvailable}
                      className="group flex min-h-32 w-full items-start gap-3 rounded-2xl border border-[#d6dfd6] bg-white p-3.5 text-left transition-[border-color,background-color,box-shadow] hover:border-[var(--store-accent)] hover:bg-[#fcfdfb] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--store-accent-ink)] disabled:cursor-not-allowed disabled:bg-[#f8f8f4] sm:gap-4 sm:p-5"
                    >
                      <CatalogImage
                        src={item.imageUrl}
                        alt=""
                        placeholderLabel="No photo"
                        className="size-20 rounded-xl sm:size-28"
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="break-words text-base font-semibold">
                          {item.name}
                        </span>
                        <span className="mt-1 text-sm font-semibold tabular-nums text-[var(--store-accent-ink)]">
                          {displayPrice(item)}
                        </span>
                        {item.productType !== "PHYSICAL" && (
                          <span className="mt-1 text-xs font-medium text-[#59685d]">
                            {item.productType === "MADE_TO_ORDER"
                              ? "Made to order"
                              : "Service"}
                          </span>
                        )}
                        {item.description && (
                          <span className="mt-2 line-clamp-2 break-words whitespace-pre-wrap text-sm leading-relaxed text-[#59685d]">
                            {item.description}
                          </span>
                        )}
                        {!item.isAvailable && (
                          <span className="mt-2 inline-flex w-fit rounded-full bg-[#f1f1eb] px-2.5 py-1 text-xs font-medium text-[#59685d]">
                            Unavailable
                          </span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <Store
              className="mx-auto size-8 text-[#59685d]"
              aria-hidden="true"
            />
            <h2 className="mt-5 text-lg font-semibold">
              Your catalog is taking shape.
            </h2>
            <p className="mt-3 text-sm text-[#59685d]">
              Add items in your workspace to see them here.
            </p>
          </div>
        )}
      </main>
      <footer className="mx-auto max-w-5xl px-5 pt-3 pb-[calc(7rem+env(safe-area-inset-bottom))] text-[13px] text-[#59685d] sm:px-8">
        Catalog powered by{" "}
        <span className="font-semibold text-[#173d2c]">PasaOrder</span>
      </footer>

      <Button
        type="button"
        onClick={() => setCartOpen(true)}
        className={`fixed right-[max(1.25rem,env(safe-area-inset-right))] z-30 h-14 gap-3 rounded-full px-5 shadow-lg hover:bg-primary hover:brightness-95 ${preview ? "bottom-[calc(var(--workspace-bottom)+1rem)] md:bottom-[max(1.25rem,env(safe-area-inset-bottom))]" : "bottom-[max(1.25rem,env(safe-area-inset-bottom))]"}`}
        aria-label={`Open cart, ${cartQuantity} ${cartQuantity === 1 ? "product selection" : "product selections"}`}
      >
        <ShoppingBag className="size-5" aria-hidden="true" />
        <span>Cart</span>
        <span className="grid min-w-6 place-items-center rounded-full bg-[var(--store-accent-text)] px-1.5 py-0.5 text-xs font-semibold tabular-nums text-[var(--store-accent)]">
          {cartQuantity}
        </span>
      </Button>

      <Dialog.Root
        open={selectedItem !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedItem(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
          {selectedItem && (
            <Dialog.Content
              style={style}
              className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(48rem,calc(100dvh-1rem))] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl border border-[#d6dfd6] bg-white shadow-xl outline-none sm:inset-x-4 sm:bottom-auto sm:top-1/2 sm:max-h-[min(48rem,calc(100dvh-2rem))] sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
            >
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="relative">
                  <CatalogImage
                    src={selectedItem.imageUrl}
                    alt=""
                    placeholderLabel="No photo"
                    className="h-56 w-full rounded-none sm:h-64"
                  />
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      aria-label="Close product details"
                      className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-white/95 text-[#18251d] shadow-sm focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
                    >
                      <X className="size-5" aria-hidden="true" />
                    </button>
                  </Dialog.Close>
                </div>
                <div className="space-y-5 px-5 py-5 sm:px-6">
                  <div>
                    <Dialog.Title className="break-words text-xl font-semibold tracking-[-0.02em]">
                      {selectedItem.name}
                    </Dialog.Title>
                    {selectedItem.productType !== "PHYSICAL" && (
                      <p className="mt-2 text-sm font-medium text-[#59685d]">
                        {selectedItem.productType === "MADE_TO_ORDER"
                          ? "Made to order"
                          : "Service"}
                      </p>
                    )}
                    <Dialog.Description className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#59685d]">
                      {selectedItem.description || "Product details"}
                    </Dialog.Description>
                  </div>
                  {selectedItem.productType === "MADE_TO_ORDER" && (
                    <p className="rounded-xl bg-[var(--store-accent-soft)] px-4 py-3 text-sm leading-relaxed text-[#35473a]">
                      Made after you order. Add personalization or design
                      details in the special instructions below.
                    </p>
                  )}
                  {selectedItem.productType === "SERVICE" && (
                    <p className="rounded-xl bg-[var(--store-accent-soft)] px-4 py-3 text-sm leading-relaxed text-[#35473a]">
                      Add any details about the service in the special
                      instructions below.
                    </p>
                  )}
                  {selectedItem.variants.length > 0 ? (
                    <fieldset className="space-y-2">
                      <legend className="mb-2 text-sm font-medium">
                        Choose an option
                      </legend>
                      {selectedItem.variants.map((variant) => (
                        <label
                          key={variant.id}
                          className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${selectedVariantId === variant.id ? "border-[var(--store-accent-ink)] bg-[var(--store-accent-soft)]" : "border-[#d6dfd6]"}`}
                        >
                          <input
                            type="radio"
                            name={`variant-${selectedItem.id}`}
                            value={variant.id}
                            checked={selectedVariantId === variant.id}
                            onChange={() => setSelectedVariantId(variant.id)}
                            className="size-4 accent-[var(--store-accent-ink)]"
                          />
                          <span className="min-w-0 flex-1 break-words">
                            {variant.label}
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-[var(--store-accent-ink)]">
                            {peso(variant.price)}
                            {selectedItem.quantityUnit === "KG" ? " / kg" : ""}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  ) : (
                    <p className="text-base font-semibold tabular-nums text-[var(--store-accent-ink)]">
                      {peso(selectedItem.price)}
                      {selectedItem.quantityUnit === "KG" ? " / kg" : ""}
                    </p>
                  )}
                  {selectedItem.addOnGroups.map((group) => (
                    <fieldset key={group.id} className="space-y-2">
                      <legend className="mb-2 text-sm font-medium">
                        {group.name}
                        {group.required ? " · Required" : " · Optional"}
                      </legend>
                      {group.selection === "SINGLE" && !group.required && (
                        <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-[#d6dfd6] px-4 py-3 text-sm">
                          <input
                            type="radio"
                            name={`addon-${group.id}`}
                            checked={
                              !selectedAddOns.some(
                                (choice) => choice.groupId === group.id,
                              )
                            }
                            onChange={() =>
                              setSelectedAddOns((current) =>
                                current.filter(
                                  (choice) => choice.groupId !== group.id,
                                ),
                              )
                            }
                            className="size-4 accent-[var(--store-accent-ink)]"
                          />
                          <span>No thanks</span>
                        </label>
                      )}
                      {group.options.map((option) => {
                        const checked = selectedAddOns.some(
                          (choice) =>
                            choice.groupId === group.id &&
                            choice.optionId === option.id,
                        );
                        return (
                          <label
                            key={option.id}
                            className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm ${checked ? "border-[var(--store-accent-ink)] bg-[var(--store-accent-soft)]" : "border-[#d6dfd6]"}`}
                          >
                            <input
                              type={
                                group.selection === "SINGLE"
                                  ? "radio"
                                  : "checkbox"
                              }
                              name={`addon-${group.id}`}
                              checked={checked}
                              onChange={() =>
                                toggleAddOn(
                                  group.id,
                                  option.id,
                                  group.selection,
                                )
                              }
                              className="size-4 accent-[var(--store-accent-ink)]"
                            />
                            <span className="min-w-0 flex-1">
                              {option.name}
                            </span>
                            <span className="font-semibold tabular-nums text-[var(--store-accent-ink)]">
                              {Number(option.price)
                                ? `+${peso(option.price)}${selectedItem.quantityUnit === "KG" ? " / kg" : ""}`
                                : "Included"}
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  ))}
                  <div className="space-y-2">
                    <label
                      htmlFor="special-instructions"
                      className="text-sm font-medium"
                    >
                      Special instructions{" "}
                      <span className="font-normal text-[#59685d]">
                        (optional)
                      </span>
                    </label>
                    <textarea
                      id="special-instructions"
                      value={instructions}
                      onChange={(event) => setInstructions(event.target.value)}
                      placeholder="Anything we should know?"
                      rows={3}
                      maxLength={300}
                      className="w-full resize-y rounded-xl border border-[#d6dfd6] bg-white px-3 py-3 text-base outline-none placeholder:text-[#768278] focus-visible:border-[var(--store-accent-ink)] focus-visible:ring-2 focus-visible:ring-ring/20"
                    />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3 border-t border-[#d6dfd6] bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
                {selectedItem.quantityUnit === "KG" ? (
                  <label className="flex h-12 shrink-0 items-center gap-2 rounded-xl border border-[#d6dfd6] px-3 text-sm font-medium">
                    <span className="sr-only">Quantity in kilograms</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min={minimumQuantity("KG")}
                      max={100}
                      step="0.001"
                      value={quantity}
                      onChange={(event) => {
                        if (event.target.value === "") return;
                        const value = Number(event.target.value);
                        if (
                          Number.isFinite(value) &&
                          value >= minimumQuantity("KG") &&
                          value <= 100
                        )
                          setQuantity(Math.round(value * 1000) / 1000);
                      }}
                      className="w-16 bg-transparent text-center text-base outline-none"
                    />
                    <span>kg</span>
                  </label>
                ) : (
                  <div className="flex h-12 shrink-0 items-center rounded-xl border border-[#d6dfd6]">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={quantity <= minimumQuantity("EACH")}
                      onClick={() =>
                        setQuantity((current) =>
                          Math.max(minimumQuantity("EACH"), current - 1),
                        )
                      }
                      className="grid size-11 place-items-center rounded-l-xl text-[var(--store-accent-ink)] hover:bg-accent disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
                    >
                      <Minus className="size-4" aria-hidden="true" />
                    </button>
                    <span
                      aria-live="polite"
                      className="min-w-8 text-center text-sm font-semibold tabular-nums"
                    >
                      {formatQuantity(quantity)}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={quantity >= 100}
                      onClick={() =>
                        setQuantity((current) => Math.min(100, current + 1))
                      }
                      className="grid size-11 place-items-center rounded-r-xl text-[var(--store-accent-ink)] hover:bg-accent focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={addToCart}
                  disabled={!hasRequiredAddOns}
                  className="h-12 min-w-0 flex-1 rounded-xl text-base hover:bg-primary hover:brightness-95"
                >
                  Add to cart ·{" "}
                  {peso(
                    String(
                      ((Math.round(
                        Number(selectedVariant?.price ?? selectedItem.price) *
                          100,
                      ) +
                        addOnCents) *
                        quantity) /
                        100,
                    ),
                  )}
                </Button>
              </div>
            </Dialog.Content>
          )}
        </Dialog.Portal>
      </Dialog.Root>

      <CartCheckout
        online={online}
        refreshing={refreshing}
        persistCheckout={!preview}
        open={cartOpen}
        onOpenChange={setCartOpen}
        storeSlug={store.slug}
        businessCategory={store.businessCategory}
        storeOrderTypes={store.orderTypes}
        storePaymentMethods={store.paymentMethods}
        gcashInstructions={{
          gcashAccountName: store.gcashAccountName,
          gcashNumber: store.gcashNumber,
          gcashQrUrl: store.gcashQrUrl,
        }}
        accentStyle={style}
        cart={cart}
        setCart={setCart}
        orderType={orderType}
        setOrderType={setOrderType}
      />
    </div>
  );
}
