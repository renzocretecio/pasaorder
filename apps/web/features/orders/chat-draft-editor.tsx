"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Camera,
  LoaderCircle,
  MessageCircleMore,
  MessageCircle,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import type {
  CatalogCategory,
  ChatOrderDraft,
  ChatOrderDraftData,
  ChatExtractionReview,
  ChatRoute,
  ChatReviewContext,
  OrderType,
  PaymentMethod,
} from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { peso } from "@/features/catalog/color";
import {
  confirmChatDraft,
  deleteChatDraft,
  readChatDraft,
  prepareChatDraft,
  replyMessengerDraft,
  saveChatDraft,
} from "./chat-actions";
import { chatRouteAdvice } from "./chat-intent";

type DraftLine = NonNullable<ChatOrderDraftData["items"]>[number];

const fieldClass =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30";
const labelClass = "mb-1.5 block text-[13px] font-medium";

export function ChatDraftEditor({
  draft,
  analysisAvailable,
  extractionAvailable,
  storeId,
  categories,
  orderTypes,
  paymentMethods,
}: {
  draft: ChatOrderDraft;
  analysisAvailable: boolean;
  extractionAvailable: boolean;
  storeId: string;
  categories: CatalogCategory[];
  orderTypes: OrderType[];
  paymentMethods: PaymentMethod[];
}) {
  const availableProducts = categories.flatMap((category) =>
    category.items.filter((item) => item.isAvailable),
  );
  const initialProduct = availableProducts[0];
  const initialItems = draft.draftData.items ?? [];
  const [conversationText, setConversationText] = useState(
    draft.conversationText,
  );
  const [replyText, setReplyText] = useState("");
  const [preparation, setPreparation] = useState<ChatExtractionReview | null>(
    null,
  );
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [skippedRoute, setSkippedRoute] = useState<Exclude<
    ChatRoute,
    "EXTRACT_ORDER"
  > | null>(null);
  const [reviewContext, setReviewContext] = useState<ChatReviewContext | null>(
    null,
  );
  const [customerName, setCustomerName] = useState(
    draft.draftData.customerName ?? "",
  );
  const [customerPhone, setCustomerPhone] = useState(
    draft.draftData.customerPhone ?? "",
  );
  const [orderType, setOrderType] = useState<OrderType>(
    draft.draftData.orderType ?? orderTypes[0] ?? "PICKUP",
  );
  const [tableNumber, setTableNumber] = useState(
    draft.draftData.tableNumber ?? "",
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    draft.draftData.deliveryAddress ?? "",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    draft.draftData.paymentMethod ?? paymentMethods[0] ?? "CASH",
  );
  const [notes, setNotes] = useState(draft.draftData.notes ?? "");
  const [items, setItems] = useState<DraftLine[]>(initialItems);
  const edited = useRef({
    orderType: Boolean(draft.draftData.orderType),
    paymentMethod: Boolean(draft.draftData.paymentMethod),
    items: Boolean(initialItems.length),
  });
  const autoReviewedDraftId = useRef<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<
    "save" | "confirm" | "delete" | "refresh" | "prepare" | "reply" | null
  >(null);
  const router = useRouter();
  const Icon =
    draft.source === "MESSENGER"
      ? MessageCircleMore
      : draft.source === "INSTAGRAM"
        ? Camera
        : MessageCircle;

  const itemTotal = useMemo(() => {
    return items.reduce((total, line) => {
      const product = availableProducts.find(
        (item) => item.id === line.productId,
      );
      const variant = product?.variants.find(
        (option) => option.id === line.variantId,
      );
      const price = Number(variant?.price ?? product?.price ?? 0);
      return total + (Number.isFinite(price) ? price * line.quantity : 0);
    }, 0);
  }, [availableProducts, items]);

  function currentData(): ChatOrderDraftData {
    return {
      customerName,
      ...(customerPhone.trim() ? { customerPhone: customerPhone.trim() } : {}),
      orderType,
      ...(orderType === "DINE_IN" && tableNumber.trim()
        ? { tableNumber: tableNumber.trim() }
        : {}),
      ...(orderType === "DELIVERY" && deliveryAddress.trim()
        ? { deliveryAddress: deliveryAddress.trim() }
        : {}),
      paymentMethod,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      items: items.map((item) => ({
        ...item,
        specialInstructions: item.specialInstructions ?? "",
      })),
    };
  }

  function save() {
    setMessage("");
    setMode("save");
    startTransition(async () => {
      const result = await saveChatDraft(draft.id, {
        conversationText,
        draftData: currentData(),
      });
      setMessage(result.message);
      setMessageIsError(!result.success);
      setMode(null);
    });
  }

  function refreshMessages() {
    setMessage("");
    setMode("refresh");
    startTransition(async () => {
      const result = await readChatDraft(draft.id);
      if (result.success) {
        if (result.draft.conversationText !== conversationText)
          setShowOrderForm(false);
        setConversationText(result.draft.conversationText);
        if (
          !customerName.trim() ||
          customerName === draft.draftData.customerName
        )
          setCustomerName(result.draft.draftData.customerName ?? "");
        setPreparation(null);
        setSkippedRoute(null);
        setReviewContext(null);
      } else {
        setMessage(result.message);
        setMessageIsError(true);
      }
      setMode(null);
    });
  }

  function sendReply() {
    setMessage("");
    setMode("reply");
    startTransition(async () => {
      const result = await replyMessengerDraft(draft.id, replyText);
      if (result.success) {
        setConversationText(result.conversationText);
        setReplyText("");
        setMessage("Reply sent from your Facebook Page.");
        setMessageIsError(false);
      } else {
        setMessage(result.message);
        setMessageIsError(true);
      }
      setMode(null);
    });
  }

  function prepare() {
    setMessage("");
    setMode("prepare");
    startTransition(async () => {
      const saved = await saveChatDraft(draft.id, {
        conversationText,
        draftData: currentData(),
      });
      if (!saved.success) {
        setMessage(saved.message);
        setMessageIsError(true);
        setMode(null);
        return;
      }
      const result = await prepareChatDraft(draft.id);
      receivePreparation(result);
      setMode(null);
    });
  }

  const applySuggestions = useCallback((review: ChatExtractionReview) => {
    const data = review.suggested;
    if (data.customerName)
      setCustomerName((current) =>
        current.trim() ? current : data.customerName!,
      );
    if (data.customerPhone)
      setCustomerPhone((current) =>
        current.trim() ? current : data.customerPhone!,
      );
    if (data.orderType && !edited.current.orderType)
      setOrderType(data.orderType);
    if (data.tableNumber)
      setTableNumber((current) =>
        current.trim() ? current : data.tableNumber!,
      );
    if (data.deliveryAddress)
      setDeliveryAddress((current) =>
        current.trim() ? current : data.deliveryAddress!,
      );
    if (data.paymentMethod && !edited.current.paymentMethod)
      setPaymentMethod(data.paymentMethod);
    if (data.notes)
      setNotes((current) => (current.trim() ? current : data.notes!));
    if (data.items?.length && !edited.current.items)
      setItems((current) => (current.length ? current : data.items!));
  }, []);

  const receivePreparation = useCallback(
    (result: Awaited<ReturnType<typeof prepareChatDraft>>) => {
      if (!result.success) {
        setMessage(result.message);
        setMessageIsError(true);
      } else if (result.skipped) {
        setConversationText(result.conversationText);
        setShowOrderForm(false);
        setPreparation(null);
        setSkippedRoute(result.route);
        setReviewContext(result.context);
      } else {
        setPreparation(result.review);
        setConversationText(result.review.conversationText);
        setShowOrderForm(true);
        setSkippedRoute(null);
        setReviewContext(null);
        applySuggestions(result.review);
      }
    },
    [applySuggestions],
  );

  useEffect(() => {
    if (
      autoReviewedDraftId.current === draft.id ||
      !(analysisAvailable || extractionAvailable) ||
      draft.conversationText.trim().length < 5
    )
      return;
    autoReviewedDraftId.current = draft.id;
    setMode("prepare");
    startTransition(async () => {
      // Opening a chat is the owner's review action. There are no local edits to save yet.
      const result = await prepareChatDraft(draft.id);
      receivePreparation(result);
      setMode(null);
    });
  }, [
    analysisAvailable,
    draft.id,
    draft.conversationText,
    extractionAvailable,
    receivePreparation,
    startTransition,
  ]);

  function confirm() {
    setMessage("");
    setMode("confirm");
    startTransition(async () => {
      const result = await confirmChatDraft(draft.id, {
        ...currentData(),
        ...(draft.source === "WEB_CHAT"
          ? { expectedConversationText: conversationText }
          : {}),
      });
      if (result.success) {
        router.push(`/dashboard/stores/${storeId}/orders`);
        router.refresh();
      } else {
        setMessage(result.message);
        setMessageIsError(true);
        setMode(null);
      }
    });
  }

  function removeDraft() {
    setMessage("");
    setMode("delete");
    startTransition(async () => {
      const result = await deleteChatDraft(draft.id);
      if (result.success) {
        router.push(`/dashboard/stores/${storeId}/chat-orders`);
        router.refresh();
      } else {
        setMessage(result.message);
        setMessageIsError(true);
        setMode(null);
      }
    });
  }

  function updateLine(index: number, updates: Partial<DraftLine>) {
    edited.current.items = true;
    setItems((current) =>
      current.map((line, i) => (i === index ? { ...line, ...updates } : line)),
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (showOrderForm) confirm();
      }}
      className="space-y-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          asChild
          variant="ghost"
          className="min-h-11 -ml-3 rounded-xl px-3 text-muted-foreground"
        >
          <Link href={`/dashboard/stores/${storeId}/chat-orders`}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Drafts
          </Link>
        </Button>
        <span className="inline-flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-primary">
          <Icon className="size-4" aria-hidden="true" />
          {draft.source === "MESSENGER"
            ? "Messenger"
            : draft.source === "INSTAGRAM"
              ? "Instagram"
              : "Web chat"}
        </span>
      </div>

      <details
        open={draft.source === "WEB_CHAT" || draft.source === "MESSENGER"}
        className="group rounded-xl border bg-card"
      >
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <span>
            {draft.source === "WEB_CHAT"
              ? "Customer messages"
              : "Original conversation"}
          </span>
          <span className="text-xs font-normal text-muted-foreground group-open:hidden">
            Show messages
          </span>
          <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">
            Hide messages
          </span>
        </summary>
        <div className="border-t p-4">
          <label htmlFor="saved-conversation" className={labelClass}>
            {draft.source === "WEB_CHAT" || draft.source === "MESSENGER"
              ? "Messages"
              : "Pasted messages"}
          </label>
          <textarea
            id="saved-conversation"
            value={conversationText}
            readOnly={
              draft.source === "WEB_CHAT" ||
              draft.source === "MESSENGER" ||
              mode === "prepare"
            }
            onChange={(event) => {
              setConversationText(event.target.value);
              setPreparation(null);
              setSkippedRoute(null);
              setReviewContext(null);
            }}
            maxLength={15000}
            rows={6}
            className="w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {draft.source === "WEB_CHAT"
              ? "Refresh to see new customer messages. They are removed when you confirm the order."
              : draft.source === "MESSENGER"
                ? "Refresh to see new messages. Replies are sent from your Facebook Page and appear in this conversation."
                : "Only the store owner can view this draft. The conversation is removed when you confirm the order."}
          </p>
          {(draft.source === "WEB_CHAT" || draft.source === "MESSENGER") && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={refreshMessages}
              className="mt-3 min-h-11 rounded-xl"
            >
              {mode === "refresh" ? "Refreshing…" : "Refresh messages"}
            </Button>
          )}
          {draft.source === "MESSENGER" && (
            <div className="mt-5 border-t pt-4">
              <label htmlFor="messenger-reply" className={labelClass}>
                Reply to customer
              </label>
              <textarea
                id="messenger-reply"
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Write a reply…"
                className="w-full resize-y rounded-xl border border-input bg-background px-3 py-3 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-lg text-xs leading-relaxed text-muted-foreground">
                  Replies follow Meta’s messaging window and Page permissions.
                </p>
                <Button
                  type="button"
                  disabled={pending || !replyText.trim()}
                  onClick={sendReply}
                  className="min-h-11 rounded-xl"
                >
                  {mode === "reply" ? (
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {mode === "reply" ? "Sending…" : "Send reply"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </details>

      {(extractionAvailable || analysisAvailable) && (
        <section
          aria-labelledby="prepare-heading"
          className="rounded-xl border bg-secondary/40 p-4 sm:p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-xl">
              <h2 id="prepare-heading" className="text-base font-semibold">
                Help with this chat
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Chat review runs automatically when you open this conversation.
                Clearly ordered, available items appear in the details below.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending || conversationText.trim().length < 5}
              onClick={() => prepare()}
              className="min-h-11 rounded-xl"
            >
              {mode === "prepare" && (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {mode === "prepare" ? "Reviewing…" : "Review again"}
            </Button>
          </div>
          {skippedRoute && (
            <div className="mt-4 border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {chatRouteAdvice[skippedRoute]}
              </p>
              {reviewContext && (
                <div className="mt-4 rounded-xl bg-secondary/50 p-4">
                  <p className="text-[13px] font-semibold">
                    {reviewContext.title}
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {reviewContext.facts.map((fact) => (
                      <li key={fact}>{fact}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {preparation && (
            <div className="mt-4 space-y-4 border-t pt-4">
              <p className="text-sm text-foreground">
                {preparation.needsAttention
                  ? "This chat still needs attention. Only clearly requested items matched to available catalog products were added below. Check everything before confirming."
                  : "Matched details were added to empty fields below. Check the order against the conversation before confirming."}
              </p>
              {!!preparation.unmatchedItems.length && (
                <div>
                  <p className="text-[13px] font-medium">
                    Not added automatically
                  </p>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {preparation.unmatchedItems.map((item, index) => (
                      <li key={`${item.name}-${index}`}>
                        {item.quantity} × {item.name}
                        {item.option ? ` · ${item.option}` : ""} — {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {!!preparation.questions.length && (
                <div>
                  <p className="text-[13px] font-medium">
                    Check before confirming
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {preparation.questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {showOrderForm ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">
              Review order details
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Match requested items to the catalog. Prices come from this store,
              and the order will not enter your queue until confirmed.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="customer-name" className={labelClass}>
                Customer name <span aria-hidden="true">*</span>
              </label>
              <input
                id="customer-name"
                required
                minLength={2}
                maxLength={120}
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                autoComplete="name"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="customer-phone" className={labelClass}>
                Mobile number{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <input
                id="customer-phone"
                type="tel"
                maxLength={40}
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                autoComplete="tel"
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="fulfillment" className={labelClass}>
                Order type
              </label>
              <select
                id="fulfillment"
                value={orderType}
                onChange={(event) => {
                  edited.current.orderType = true;
                  setOrderType(event.target.value as OrderType);
                }}
                className={fieldClass}
              >
                {orderTypes.map((type) => (
                  <option key={type} value={type}>
                    {type === "DINE_IN"
                      ? "Dine in"
                      : type === "PICKUP"
                        ? "Pickup / to go"
                        : "Delivery"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="payment" className={labelClass}>
                Payment method
              </label>
              <select
                id="payment"
                value={paymentMethod}
                onChange={(event) => {
                  edited.current.paymentMethod = true;
                  setPaymentMethod(event.target.value as PaymentMethod);
                }}
                className={fieldClass}
              >
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method === "GCASH" ? "GCash" : "Cash"}
                  </option>
                ))}
              </select>
            </div>
            {orderType === "DINE_IN" && (
              <div>
                <label htmlFor="table-number" className={labelClass}>
                  Table number{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <input
                  id="table-number"
                  maxLength={40}
                  value={tableNumber}
                  onChange={(event) => setTableNumber(event.target.value)}
                  className={fieldClass}
                />
              </div>
            )}
            {orderType === "DELIVERY" && (
              <div className="sm:col-span-2">
                <label htmlFor="delivery-address" className={labelClass}>
                  Delivery address <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="delivery-address"
                  required
                  maxLength={500}
                  rows={2}
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  The delivery fee will be set when you confirm the order in the
                  queue.
                </p>
              </div>
            )}
          </div>

          <section aria-labelledby="items-heading">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 id="items-heading" className="text-base font-semibold">
                  Items
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Select matching items from the current catalog.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!availableProducts.length}
                onClick={() => {
                  edited.current.items = true;
                  setItems((current) => [
                    ...current,
                    {
                      productId: initialProduct!.id,
                      variantId: initialProduct!.variants[0]?.id ?? null,
                      quantity: 1,
                    },
                  ]);
                }}
                className="min-h-11 rounded-xl"
              >
                <Plus className="size-4" aria-hidden="true" />
                Add item
              </Button>
            </div>
            {items.length ? (
              <div className="divide-y rounded-xl border bg-card">
                {items.map((line, index) => {
                  const product = availableProducts.find(
                    (item) => item.id === line.productId,
                  );
                  return (
                    <div
                      key={`${index}-${line.productId}`}
                      className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(9rem,0.65fr)_6rem_auto] sm:items-end sm:p-4"
                    >
                      <div>
                        <label
                          htmlFor={`product-${index}`}
                          className={labelClass}
                        >
                          Catalog item
                        </label>
                        <select
                          id={`product-${index}`}
                          required
                          value={line.productId}
                          onChange={(event) => {
                            const next = availableProducts.find(
                              (item) => item.id === event.target.value,
                            );
                            updateLine(index, {
                              productId: event.target.value,
                              variantId: next?.variants[0]?.id ?? null,
                            });
                          }}
                          className={fieldClass}
                        >
                          {availableProducts.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor={`variant-${index}`}
                          className={labelClass}
                        >
                          Size / option
                        </label>
                        {product?.variants.length ? (
                          <select
                            id={`variant-${index}`}
                            required
                            value={line.variantId ?? ""}
                            onChange={(event) =>
                              updateLine(index, {
                                variantId: event.target.value || null,
                              })
                            }
                            className={fieldClass}
                          >
                            <option value="" disabled>
                              Choose an option
                            </option>
                            {product.variants.map((variant) => (
                              <option key={variant.id} value={variant.id}>
                                {variant.label} · {peso(variant.price)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <p className="flex h-11 items-center px-1 text-sm text-muted-foreground">
                            Standard · {peso(product?.price ?? "0")}
                          </p>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor={`quantity-${index}`}
                          className={labelClass}
                        >
                          Quantity
                        </label>
                        <input
                          id={`quantity-${index}`}
                          type="number"
                          min={1}
                          max={100}
                          required
                          value={line.quantity}
                          onChange={(event) =>
                            updateLine(index, {
                              quantity: Number(event.target.value),
                            })
                          }
                          className={fieldClass}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`Remove item ${index + 1}`}
                        onClick={() => {
                          edited.current.items = true;
                          setItems((current) =>
                            current.filter((_, i) => i !== index),
                          );
                        }}
                        className="min-h-11 w-full rounded-xl text-muted-foreground hover:text-destructive sm:w-11"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        <span className="sm:sr-only">Remove</span>
                      </Button>
                      <div className="sm:col-span-4">
                        <label
                          htmlFor={`instruction-${index}`}
                          className={labelClass}
                        >
                          Special instructions{" "}
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        </label>
                        <input
                          id={`instruction-${index}`}
                          maxLength={500}
                          value={line.specialInstructions ?? ""}
                          onChange={(event) =>
                            updateLine(index, {
                              specialInstructions: event.target.value,
                            })
                          }
                          placeholder="For example, no onions"
                          className={fieldClass}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <p className="text-sm font-medium">
                  {availableProducts.length
                    ? "No items selected"
                    : "No available catalog items"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {availableProducts.length
                    ? "Choose items from the catalog before confirming this order."
                    : "Add an available item to the catalog before confirming this order."}
                </p>
              </div>
            )}
            <div className="mt-3 flex justify-between gap-4 border-t pt-3 text-sm font-semibold">
              <span>Items subtotal</span>
              <span className="tabular-nums">{peso(itemTotal.toFixed(2))}</span>
            </div>
          </section>

          <div>
            <label htmlFor="order-notes" className={labelClass}>
              Order note{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              id="order-notes"
              maxLength={500}
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowOrderForm(true)}
          className="min-h-11 rounded-xl"
        >
          Create order manually
        </Button>
      )}

      {message && (
        <p
          role={messageIsError ? "alert" : "status"}
          className={
            messageIsError
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {message}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={removeDraft}
          className="min-h-11 justify-start rounded-xl px-3 text-destructive hover:text-destructive sm:justify-center"
        >
          {mode === "delete" ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="size-4" aria-hidden="true" />
          )}
          Delete draft
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          {(showOrderForm || draft.source !== "WEB_CHAT") && (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={save}
              className="min-h-11 rounded-xl"
            >
              {mode === "save" && (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {mode === "save" ? "Saving…" : "Save draft"}
            </Button>
          )}
          {showOrderForm && (
            <Button
              type="submit"
              disabled={pending || !items.length || !availableProducts.length}
              className="min-h-11 rounded-xl"
            >
              {mode === "confirm" && (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              )}
              {mode === "confirm"
                ? "Creating order…"
                : "Confirm and add to orders"}
            </Button>
          )}
        </div>
      </div>
      {showOrderForm && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Confirming creates a new unpaid order. You can review payment and
          delivery fee in the order queue.
        </p>
      )}
    </form>
  );
}
