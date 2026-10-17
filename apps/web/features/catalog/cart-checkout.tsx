"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Copy, Minus, Plus, ShoppingBag } from "lucide-react";
import { Dialog } from "radix-ui";
import type {
  BusinessCategory,
  OrderType,
  PaymentInstructions,
  PaymentMethod,
  PaymentStatus,
} from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { orderTypeLabel } from "./order-type-label";
import { CatalogImage } from "./catalog-image";
import { orderTypes } from "@pasaorder/types";
import { peso } from "./color";

import {
  checkoutRequestKey,
  clearCheckoutRequest,
  deviceStorage,
  type CartLine,
} from "./saved-cart";

type PlacedOrder = {
  id: string;
  total: string;
  orderType: OrderType;
  trackingToken: string;
  scheduledFor: string | null;
  deliveryFee: string | null;
  tableNumber: string | null;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentInstructions: PaymentInstructions | null;
};

function GcashInstructions({
  instructions,
  waitForConfirmation = false,
  waitForTotal = false,
  amount,
}: {
  instructions: PaymentInstructions;
  waitForConfirmation?: boolean;
  waitForTotal?: boolean;
  amount?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  async function copyDetails() {
    try {
      await navigator.clipboard.writeText(instructions.gcashNumber);
      setCopied(true);
      setCopyError(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  }
  return (
    <div className="rounded-xl border border-[#d6dfd6] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Send payment to</p>
          <p className="mt-2 break-words text-sm">
            {instructions.gcashAccountName}
          </p>
          <p className="mt-0.5 text-sm tabular-nums text-[#59685d]">
            {instructions.gcashNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={copyDetails}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium hover:bg-[#f6f8f4] focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
        >
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Copied" : "Copy number"}
        </button>
      </div>
      {!waitForConfirmation && !waitForTotal && amount && (
        <div className="mt-3 flex justify-between gap-4 border-t border-[#e4e9e2] pt-3 text-sm">
          <span className="text-[#59685d]">Amount to send</span>
          <span className="font-semibold tabular-nums">{amount}</span>
        </div>
      )}
      {copyError && (
        <p role="status" className="mt-2 text-xs text-[#59685d]">
          Copy wasn’t available. You can select and copy the details above.
        </p>
      )}
      {instructions.gcashQrUrl && (
        <div className="mt-4 flex items-center gap-4 border-t border-[#e4e9e2] pt-4">
          <a
            href={instructions.gcashQrUrl}
            download="gcash-payment-qr.webp"
            className="grid size-24 shrink-0 place-items-center rounded-lg border bg-white p-1 focus-visible:outline-2 focus-visible:outline-[var(--store-accent-ink)]"
            aria-label="Download GCash QR code"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- The same stored QR may be OCI-hosted or a merchant HTTPS URL. */}
            <img
              src={instructions.gcashQrUrl}
              alt="GCash payment QR code"
              className="size-full object-contain"
            />
          </a>
          <div className="text-sm">
            <p className="font-medium">Or scan the QR code</p>
            <a
              href={instructions.gcashQrUrl}
              download="gcash-payment-qr.webp"
              className="mt-1 inline-flex min-h-11 items-center font-medium text-[var(--store-accent-ink)] underline underline-offset-4"
            >
              Download QR
            </a>
          </div>
        </div>
      )}
      {waitForTotal && (
        <p className="mt-3 border-t border-[#e4e9e2] pt-3 text-xs leading-relaxed text-[#59685d]">
          Wait for the store to confirm your delivery fee and final total before
          sending payment.
        </p>
      )}
      {waitForConfirmation && !waitForTotal && (
        <p className="mt-3 border-t border-[#e4e9e2] pt-3 text-xs leading-relaxed text-[#59685d]">
          Wait for the store to confirm your order before sending payment.
        </p>
      )}
    </div>
  );
}

function cents(value: string) {
  return Math.round(Number(value) * 100);
}

export function CartCheckout({
  online,
  refreshing,
  persistCheckout,
  open,
  onOpenChange,
  storeSlug,
  businessCategory,
  storeOrderTypes,
  storePaymentMethods,
  gcashInstructions,
  accentStyle,
  cart,
  setCart,
  orderType,
  setOrderType,
}: {
  online: boolean;
  refreshing: boolean;
  persistCheckout: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  businessCategory: BusinessCategory;
  storeOrderTypes: OrderType[];
  storePaymentMethods: PaymentMethod[];
  gcashInstructions: Omit<
    PaymentInstructions,
    "gcashAccountName" | "gcashNumber"
  > & {
    gcashAccountName: string | null;
    gcashNumber: string | null;
  };
  accentStyle: React.CSSProperties;
  cart: CartLine[];
  setCart: Dispatch<SetStateAction<CartLine[]>>;
  orderType: OrderType;
  setOrderType: (value: OrderType) => void;
}) {
  const supportsTableNumber =
    businessCategory === "FOOD_BEVERAGE" || businessCategory === "BAKERY";
  const [step, setStep] = useState<"cart" | "checkout" | "placed">("cart");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [scheduleForLater, setScheduleForLater] = useState(false);
  const [scheduledForInput, setScheduledForInput] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    storePaymentMethods[0] ?? "CASH",
  );
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const cartQuantity = cart.reduce((sum, line) => sum + line.quantity, 0);
  const subtotalCents = cart.reduce(
    (sum, line) =>
      sum +
      (cents(line.variant?.price ?? line.item.price) +
        line.addOns.reduce((extra, choice) => {
          const option = line.item.addOnGroups
            .find((group) => group.id === choice.groupId)
            ?.options.find((entry) => entry.id === choice.optionId);
          return extra + (option ? cents(option.price) : 0);
        }, 0)) *
        line.quantity,
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
        setScheduleForLater(false);
        setScheduledForInput("");
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
            ? { ...line, quantity: Math.min(100, line.quantity + amount) }
            : line,
        )
        .filter((line) => line.quantity > 0),
    );
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !cart.length || refreshing) return;
    if (!online || !navigator.onLine) {
      setError(
        "You’re offline. Reconnect, then place your order. Your cart stays here.",
      );
      return;
    }
    if (scheduleForLater && orderType !== "DINE_IN") {
      const requestedTime = Date.parse(`${scheduledForInput}+08:00`);
      const now = Date.now();
      if (
        !Number.isFinite(requestedTime) ||
        requestedTime < now + 15 * 60_000
      ) {
        setError("Choose a time at least 15 minutes from now.");
        return;
      }
      if (requestedTime > now + 90 * 24 * 60 * 60_000) {
        setError("Choose a date within the next 90 days.");
        return;
      }
    }
    setPending(true);
    setError("");
    const storage = persistCheckout ? deviceStorage() : null;
    const requestKey = checkoutRequestKey(storeSlug, idempotencyKey, storage);
    setIdempotencyKey(requestKey);
    try {
      const orderPayload = {
        storeSlug,
        idempotencyKey: requestKey,
        customerName: name,
        customerPhone:
          orderType === "DINE_IN" ? undefined : phone.trim() || undefined,
        orderType,
        paymentMethod,
        tableNumber:
          orderType === "DINE_IN" && supportsTableNumber
            ? tableNumber.trim() || undefined
            : undefined,
        deliveryAddress: orderType === "DELIVERY" ? address : undefined,
        scheduledFor:
          scheduleForLater && orderType !== "DINE_IN" && scheduledForInput
            ? new Date(`${scheduledForInput}+08:00`).toISOString()
            : undefined,
        notes: notes || undefined,
        items: cart.map((line) => ({
          productId: line.item.id,
          variantId: line.variant?.id ?? null,
          quantity: line.quantity,
          specialInstructions: line.instructions || undefined,
          addOns: line.addOns,
        })),
      };
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        // A definite client rejection can be corrected with a new attempt.
        // Network/server failures keep the key because the order may exist.
        if (
          response.status >= 400 &&
          response.status < 500 &&
          response.status !== 408
        ) {
          clearCheckoutRequest(storeSlug, storage);
          setIdempotencyKey(null);
        }
        throw new Error(
          result?.message ?? "We couldn’t place your order. Please try again.",
        );
      }
      if (!result?.order?.trackingToken)
        throw new Error(
          "We couldn’t confirm the result. Please retry to check your order.",
        );
      setPlacedOrder(result.order as PlacedOrder);
      setCart([]);
      setIdempotencyKey(null);
      clearCheckoutRequest(storeSlug, storage);
      setStep("placed");
    } catch (submitError) {
      setError(
        submitError instanceof TypeError
          ? "Connection interrupted. Your cart is still here. Reconnect and retry; the same attempt will be checked to avoid a duplicate order."
          : submitError instanceof Error
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
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[min(44rem,calc(100dvh-0.5rem))] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[#d6dfd6] bg-white text-[#18251d] shadow-xl outline-none sm:inset-x-4 sm:bottom-auto sm:top-1/2 sm:max-h-[min(44rem,calc(100dvh-2rem))] sm:w-[calc(100%-2rem)] sm:-translate-y-1/2 sm:rounded-2xl"
        >
          {(!online || refreshing) && step !== "placed" && (
            <p
              role="status"
              className="border-b border-[#d6dfd6] bg-[#f6f5ef] px-5 py-3 text-sm text-[#59685d]"
            >
              {!online
                ? "You’re offline. Keep editing your cart and reconnect before placing your order."
                : "Refreshing the catalog after reconnecting…"}
            </p>
          )}
          {step === "placed" && placedOrder ? (
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-10 text-center">
              <div className="grid size-14 place-items-center rounded-full bg-[var(--store-accent-soft)] text-[var(--store-accent-ink)]">
                <Check aria-hidden="true" className="size-7" />
              </div>
              <Dialog.Title className="mt-5 text-xl font-semibold tracking-[-0.02em]">
                Order placed
              </Dialog.Title>
              <Dialog.Description className="mt-2 max-w-sm text-sm leading-relaxed text-[#59685d]">
                Thanks, {name}. The store will review your{" "}
                {orderTypeLabel(
                  placedOrder.orderType,
                  businessCategory,
                ).toLowerCase()}{" "}
                order
                {placedOrder.orderType === "DINE_IN"
                  ? "."
                  : ` and contact you at ${phone}.`}
              </Dialog.Description>
              {placedOrder.paymentMethod === "GCASH" &&
                placedOrder.paymentInstructions && (
                  <div className="mt-5 w-full text-left">
                    <p className="mb-2 text-sm font-semibold">GCash payment</p>
                    <GcashInstructions
                      instructions={placedOrder.paymentInstructions}
                      waitForConfirmation={true}
                      waitForTotal={placedOrder.orderType === "DELIVERY"}
                      amount={peso(placedOrder.total)}
                    />
                  </div>
                )}
              <div className="mt-6 w-full rounded-xl bg-[#f6f8f4] px-4 py-3 text-left">
                <div className="flex justify-between gap-4 text-sm">
                  <span className="text-[#59685d]">Order number</span>
                  <span className="font-semibold">#{placedOrder.id}</span>
                </div>
                {supportsTableNumber &&
                  placedOrder.orderType === "DINE_IN" &&
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
                {placedOrder.scheduledFor && (
                  <p className="mt-3 text-xs leading-relaxed text-[#59685d]">
                    Requested for{" "}
                    {new Date(placedOrder.scheduledFor).toLocaleString(
                      "en-PH",
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Asia/Manila",
                      },
                    )}{" "}
                    Philippine time. The store will confirm availability.
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
                      Mobile number{" "}
                      <span className="font-normal text-[#59685d]">
                        (optional)
                      </span>
                    </label>
                    <input
                      id="checkout-phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      minLength={6}
                      maxLength={40}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="e.g. 0917 123 4567"
                      className="h-12 w-full rounded-xl border border-[#d6dfd6] bg-white px-3 text-base outline-none focus:border-[var(--store-accent-ink)] focus:ring-2 focus:ring-[var(--store-accent-soft)]"
                    />
                  </div>
                )}
                {supportsTableNumber && orderType === "DINE_IN" && (
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
                {orderType !== "DINE_IN" && (
                  <fieldset className="rounded-xl border border-[#d6dfd6] px-4 py-3">
                    <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={scheduleForLater}
                        onChange={(event) =>
                          setScheduleForLater(event.target.checked)
                        }
                        className="size-4 accent-[var(--store-accent-ink)]"
                      />
                      Schedule for later
                    </label>
                    {scheduleForLater && (
                      <div className="mt-3">
                        <label
                          htmlFor="checkout-scheduled-for"
                          className="mb-1.5 block text-sm font-medium"
                        >
                          {orderType === "PICKUP" ? "Pickup" : "Delivery"} date
                          and time
                        </label>
                        <input
                          id="checkout-scheduled-for"
                          name="scheduledFor"
                          type="datetime-local"
                          required
                          value={scheduledForInput}
                          onChange={(event) =>
                            setScheduledForInput(event.target.value)
                          }
                          className="h-12 w-full rounded-xl border border-[#d6dfd6] bg-white px-3 text-base outline-none focus:border-[var(--store-accent-ink)] focus:ring-2 focus:ring-[var(--store-accent-soft)]"
                        />
                        <p className="mt-1.5 text-xs leading-relaxed text-[#59685d]">
                          Times use Philippine time. Choose at least 15 minutes
                          ahead and within 90 days. The store will confirm
                          availability.
                        </p>
                      </div>
                    )}
                  </fieldset>
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
                <fieldset className="space-y-3">
                  <legend className="text-sm font-medium">
                    Payment method
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    {storePaymentMethods.map((method) => (
                      <label
                        key={method}
                        className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-medium ${paymentMethod === method ? "border-[var(--store-accent-ink)] bg-[var(--store-accent-soft)] text-[var(--store-accent-ink)]" : "border-[#d6dfd6]"}`}
                      >
                        <input
                          type="radio"
                          name="paymentMethod"
                          value={method}
                          checked={paymentMethod === method}
                          onChange={() => setPaymentMethod(method)}
                          className="accent-[var(--store-accent-ink)]"
                        />
                        {method === "CASH" ? "Cash" : "GCash"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {paymentMethod === "GCASH" &&
                  gcashInstructions.gcashAccountName &&
                  gcashInstructions.gcashNumber && (
                    <GcashInstructions
                      instructions={{
                        gcashAccountName: gcashInstructions.gcashAccountName,
                        gcashNumber: gcashInstructions.gcashNumber,
                        gcashQrUrl: gcashInstructions.gcashQrUrl,
                      }}
                      waitForConfirmation={true}
                      waitForTotal={orderType === "DELIVERY"}
                      amount={subtotal}
                    />
                  )}
                {error && (
                  <p role="alert" className="text-sm text-destructive">
                    {error}
                  </p>
                )}
              </div>
              <div className="border-t border-[#d6dfd6] px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
                <Button
                  type="submit"
                  disabled={pending || !cart.length || !online || refreshing}
                  className="h-12 w-full rounded-xl text-base"
                >
                  {pending
                    ? "Placing order…"
                    : !online
                      ? "Reconnect to place order"
                      : refreshing
                        ? "Refreshing catalog…"
                        : `Place order · ${subtotal}`}
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
                          <span>
                            {orderTypeLabel(option, businessCategory)}
                          </span>
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
                        {line.addOns.length > 0 && (
                          <p className="mt-1 text-[13px] text-[#59685d]">
                            Add-ons:{" "}
                            {line.addOns
                              .map(
                                (choice) =>
                                  line.item.addOnGroups
                                    .find(
                                      (group) => group.id === choice.groupId,
                                    )
                                    ?.options.find(
                                      (option) => option.id === choice.optionId,
                                    )?.name,
                              )
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                        {line.answers.length > 0 && (
                          <div className="mt-1 space-y-0.5 text-[13px] text-[#59685d]">
                            {line.answers.map((answer) => (
                              <p
                                key={answer.questionId}
                                className="break-words"
                              >
                                {answer.label}:{" "}
                                {answer.value === "true"
                                  ? "Yes"
                                  : answer.value === "false"
                                    ? "No"
                                    : answer.value}
                              </p>
                            ))}
                          </div>
                        )}
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
                                ((cents(
                                  line.variant?.price ?? line.item.price,
                                ) +
                                  line.addOns.reduce(
                                    (extra, choice) =>
                                      extra +
                                      cents(
                                        line.item.addOnGroups
                                          .find(
                                            (group) =>
                                              group.id === choice.groupId,
                                          )
                                          ?.options.find(
                                            (option) =>
                                              option.id === choice.optionId,
                                          )?.price ?? "0",
                                      ),
                                    0,
                                  )) *
                                  line.quantity) /
                                  100,
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
              <div className="border-t border-[#d6dfd6] px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
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
