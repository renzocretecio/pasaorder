"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { Dialog } from "radix-ui";
import type { OrderType, Product, ProductVariant } from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { CatalogImage } from "./catalog-image";
import { orderTypes } from "@pasaorder/types";
import { peso } from "./color";

type CartLine = {
  key: string;
  item: Product;
  variant: ProductVariant | null;
  quantity: number;
  instructions: string;
};

type PlacedOrder = {
  id: string;
  total: string;
  orderType: OrderType;
  trackingToken: string;
  deliveryFee: string | null;
  tableNumber: string | null;
};

function orderTypeLabel(orderType: OrderType) {
  if (orderType === "DINE_IN") return "Dine in";
  if (orderType === "PICKUP") return "Takeaway";
  return "Delivery";
}

function cents(value: string) {
  return Math.round(Number(value) * 100);
}

export function CartCheckout({
  open,
  onOpenChange,
  storeSlug,
  storeOrderTypes,
  accentStyle,
  cart,
  setCart,
  orderType,
  setOrderType,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  storeOrderTypes: OrderType[];
  accentStyle: React.CSSProperties;
  cart: CartLine[];
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  orderType: OrderType;
  setOrderType: (value: OrderType) => void;
}) {
  const [step, setStep] = useState<"cart" | "checkout" | "placed">("cart");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const cartQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalCents = cart.reduce(
    (sum, line) =>
      sum + cents(line.variant?.price ?? line.item.price) * line.quantity,
    0,
  );
  const subtotal = peso((subtotalCents / 100).toFixed(2));

  function close(openState: boolean) {
    onOpenChange(openState);
    if (!openState) {
      setError("");
      if (step === "placed") {
        setStep("cart");
        setPlacedOrder(null);
        setName("");
        setPhone("");
        setAddress("");
        setTableNumber("");
        setNotes("");
      }
    }
  }

  function changeQuantity(key: string, amount: number) {
    setCart((current) =>
      current
        .map((line) =>
          line.key === key
            ? { ...line, quantity: line.quantity + amount }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !cart.length) return;
    setPending(true);
    setError("");
    const requestKey = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(requestKey);
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          storeSlug,
          idempotencyKey: requestKey,
          customerName: name,
          customerPhone: orderType === "DINE_IN" ? undefined : phone,
          orderType,
          tableNumber:
            orderType === "DINE_IN"
              ? tableNumber.trim() || undefined
              : undefined,
          deliveryAddress: orderType === "DELIVERY" ? address : undefined,
          notes: notes || undefined,
          items: cart.map((line) => ({
            productId: line.item.id,
            variantId: line.variant?.id ?? null,
            quantity: line.quantity,
            specialInstructions: line.instructions || undefined,
          })),
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          body?.message ?? "We couldn’t place your order. Please try again.",
        );
      setPlacedOrder(body.order as PlacedOrder);
      setCart([]);
      setIdempotencyKey(null);
      setStep("placed");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn’t place your order. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45" />
        <Dialog.Content
          style={accentStyle}
          className="fixed inset-x-3 top-1/2 z-50 mx-auto flex max-h-[min(44rem,calc(100dvh-1.5rem))] w-[calc(100%-1.5rem)] max-w-lg -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[#d6dfd6] bg-white text-[#18251d] shadow-xl outline-none"
        >
          {step === "placed" && placedOrder ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-[var(--store-accent-soft)] text-[var(--store-accent-ink)]">
                <Check aria-hidden="true" className="size-7" />
              </div>
              <Dialog.Title className="mt-5 text-xl font-semibold tracking-[-0.02em]">
                Order placed
              </Dialog.Title>
              <Dialog.Description className="mt-2 max-w-sm text-sm leading-relaxed text-[#59685d]">
                Thanks, {name}. The store will review your{" "}
                {orderTypeLabel(placedOrder.orderType).toLowerCase()} order
                {placedOrder.orderType === "DINE_IN"
                  ? "."
                  : ` and contact you at ${phone}.`}
              </Dialog.Description>
              <div className="mt-6 w-full rounded-xl bg-[#f6f8f4] px-4 py-3 text-left">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[#59685d]">Order number</span>
                  <span className="font-semibold">#{placedOrder.id}</span>
                </div>
                {placedOrder.orderType === "DINE_IN" &&
                  placedOrder.tableNumber && (
                    <div className="mt-2 flex justify-between gap-4 text-sm">
                      <span className="text-[#59685d]">Table</span>
                      <span className="font-semibold">
                        {placedOrder.tableNumber}
                      </span>
                    </div>
                  )}
                <div className="mt-2 flex justify-between gap-4 text-sm">
                  <span className="text-[#59685d]">Items subtotal</span>
                  <span className="font-semibold tabular-nums">
                    {peso(placedOrder.total)}
                  </span>
                </div>
                {placedOrder.orderType === "DELIVERY" && (
                  <p className="mt-3 text-xs leading-relaxed text-[#59685d]">
                    Delivery fee will be confirmed by the store before your
                    order is finalized.
                  </p>
                )}
              </div>
              <Button asChild className="mt-6 h-12 w-full rounded-xl">
                <Link
                  href={`/order/${placedOrder.trackingToken}`}
                  onClick={() => close(false)}
                >
                  Track your order
                </Link>
              </Button>
              <button
                type="button"
                onClick={() => close(false)}
                className="mt-3 min-h-11 text-sm font-medium text-[#59685d] underline underline-offset-4"
              >
                Done for now
              </button>
            </div>
          ) : step === "checkout" ? (
            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={submitOrder}
            >
              <div className="flex items-center gap-3 border-b border-[#d6dfd6] px-5 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setStep("cart");
                  }}
                  className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-[#f2f5f0] focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
                  aria-label="Back to cart"
                >
                  <ArrowLeft className="size-5" aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <Dialog.Title className="text-lg font-semibold">
                    Your details
                  </Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-sm text-[#59685d]">
                    {cartQuantity} {cartQuantity === 1 ? "item" : "items"} ·{" "}
                    {subtotal}
                  </Dialog.Description>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
                <div>
                  <label
                    htmlFor="checkout-name"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Your name
                  </label>
                  <input
                    id="checkout-name"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="h-12 w-full rounded-xl border border-[#d6dfd6] bg-white px-3 text-base outline-none focus:border-[var(--store-accent-ink)] focus:ring-2 focus:ring-[var(--store-accent-soft)]"
                  />
                </div>
                {orderType !== "DINE_IN" && (
                  <div>
                    <label
                      htmlFor="checkout-phone"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Mobile number
                    </label>
                    <input
                      id="checkout-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={6}
                      maxLength={40}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="e.g. 0917 123 4567"
                      className="h-12 w-full rounded-xl border border-[#d6dfd6] bg-white px-3 text-base outline-none focus:border-[var(--store-accent-ink)] focus:ring-2 focus:ring-[var(--store-accent-soft)]"
                    />
                  </div>
                )}
                {orderType === "DINE_IN" && (
                  <div>
                    <label
                      htmlFor="checkout-table-number"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Table number{" "}
                      <span className="font-normal text-[#59685d]">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="checkout-table-number"
                      name="tableNumber"
                      maxLength={40}
                      value={tableNumber}
                      onChange={(event) => setTableNumber(event.target.value)}
                      placeholder="e.g. 12 or Patio 2"
                      className="h-12 w-full rounded-xl border border-[#d6dfd6] bg-white px-3 text-base outline-none focus:border-[var(--store-accent-ink)] focus:ring-2 focus:ring-[var(--store-accent-soft)]"
                    />
                  </div>
                )}
                {orderType === "DELIVERY" && (
                  <div>
                    <label
                      htmlFor="checkout-address"
                      className="mb-1.5 block text-sm font-medium"
                    >
                      Delivery address
                    </label>
                    <textarea
                      id="checkout-address"
                      name="address"
                      autoComplete="street-address"
                      required
                      maxLength={500}
                      rows={3}
                      value={address}
                      onChange={(event) => setAddress(event.target.value)}
                      placeholder="House or unit, street, barangay, city"
                      className="w-full resize-y rounded-xl border border-[#d6dfd6] bg-white px-3 py-3 text-base outline-none focus:border-[var(--store-accent-ink)] focus:ring-2 focus:ring-[var(--store-accent-soft)]"
                    />
                    <p className="mt-1.5 text-xs leading-relaxed text-[#59685d]">
                      The store will confirm the delivery fee based on your
                      location.
                    </p>
                  </div>
                )}
                <div>
                  <label
                    htmlFor="checkout-notes"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Order note{" "}
                    <span className="font-normal text-[#59685d]">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    id="checkout-notes"
                    name="notes"
                    maxLength={500}
                    rows={2}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={"Anything the store should know"}
                    className="w-full resize-y rounded-xl border border-[#d6dfd6] bg-white px-3 py-3 text-base outline-none focus:border-[var(--store-accent-ink)] focus:ring-2 focus:ring-[var(--store-accent-soft)]"
                  />
                </div>
                <div className="rounded-xl bg-[#f6f8f4] px-4 py-3">
                  <div className="flex justify-between gap-4 text-sm font-semibold">
                    <span>Items subtotal</span>
                    <span className="tabular-nums">{subtotal}</span>
                  </div>
                  {orderType === "DELIVERY" && (
                    <p className="mt-2 text-xs leading-relaxed text-[#59685d]">
                      Delivery fee is not included. The store will confirm it
                      with you before finalizing your order.
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium">Payment</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[#59685d]">
                    The store will confirm payment instructions after reviewing
                    your order.
                  </p>
                </div>
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <div className="border-t border-[#d6dfd6] px-5 py-4">
                <Button
                  type="submit"
                  disabled={pending || !cart.length}
                  className="h-12 w-full rounded-xl text-base"
                >
                  {pending ? "Placing order…" : `Place order · ${subtotal}`}
                </Button>
                <p className="mt-2 text-center text-xs text-[#59685d]">
                  No account needed. The store will contact you to confirm.
                </p>
              </div>
            </form>
          ) : (
            <>
              <div className="border-b border-[#d6dfd6] px-5 py-4">
                <Dialog.Title className="text-lg font-semibold">
                  Your cart
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-[#59685d]">
                  {cartQuantity} {cartQuantity === 1 ? "item" : "items"}
                </Dialog.Description>
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    How would you like your order?
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {orderTypes
                      .filter((option) => storeOrderTypes.includes(option))
                      .map((option) => (
                        <label
                          key={option}
                          className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${orderType === option ? "border-[var(--store-accent-ink)] bg-[var(--store-accent-soft)] font-medium" : "border-[#d6dfd6]"}`}
                        >
                          <input
                            type="radio"
                            name="order-type"
                            value={option}
                            checked={orderType === option}
                            onChange={() => setOrderType(option)}
                            className="size-4 accent-[var(--store-accent-ink)]"
                          />
                          <span>{orderTypeLabel(option)}</span>
                        </label>
                      ))}
                  </div>
                </fieldset>
                {cart.length ? (
                  cart.map((line) => (
                    <div
                      key={line.key}
                      className="flex gap-3 border-b border-[#e4e9e2] pb-4 last:border-0"
                    >
                      <CatalogImage
                        src={line.item.imageUrl}
                        alt=""
                        className="size-16 rounded-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold">
                          {line.item.name}
                        </p>
                        <p className="mt-1 text-[13px] text-[var(--store-accent-ink)]">
                          {line.variant ? `${line.variant.label} · ` : ""}
                          {peso(line.variant?.price ?? line.item.price)} each
                        </p>
                        {line.instructions && (
                          <p className="mt-1 break-words text-[13px] text-[#59685d]">
                            Note: {line.instructions}
                          </p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Remove one ${line.item.name}`}
                            onClick={() => changeQuantity(line.key, -1)}
                            className="grid size-9 place-items-center rounded-lg border border-[#d6dfd6] text-[var(--store-accent-ink)] hover:bg-accent focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
                          >
                            <Minus className="size-3.5" aria-hidden="true" />
                          </button>
                          <span className="min-w-6 text-center text-sm tabular-nums">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={`Add one ${line.item.name}`}
                            onClick={() => changeQuantity(line.key, 1)}
                            className="grid size-9 place-items-center rounded-lg border border-[#d6dfd6] text-[var(--store-accent-ink)] hover:bg-accent focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                          <span className="ml-auto font-semibold tabular-nums text-[var(--store-accent-ink)]">
                            {peso(
                              String(
                                Number(line.variant?.price ?? line.item.price) *
                                  line.quantity,
                              ),
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-sm text-[#59685d]">
                    Your cart is empty.
                  </p>
                )}
              </div>
              <div className="border-t border-[#d6dfd6] px-5 py-4">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>
                    {orderType === "DELIVERY"
                      ? "Items subtotal"
                      : "Estimated total"}
                  </span>
                  <span className="tabular-nums text-[var(--store-accent-ink)]">
                    {subtotal}
                  </span>
                </div>
                {orderType === "DELIVERY" && cart.length > 0 && (
                  <p className="mt-2 text-xs leading-relaxed text-[#59685d]">
                    The store will set the delivery fee when confirming your
                    order. It isn&apos;t included in this subtotal.
                  </p>
                )}
                <Button
                  type="button"
                  disabled={!cart.length}
                  onClick={() => {
                    setError("");
                    setStep("checkout");
                  }}
                  className="mt-4 h-12 w-full gap-2 rounded-xl text-base"
                >
                  <ShoppingBag className="size-4" aria-hidden="true" />
                  Continue to checkout
                </Button>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
