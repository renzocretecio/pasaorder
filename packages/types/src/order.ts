export type OrderStatus =
  "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

export const orderTypes = ["DINE_IN", "PICKUP", "DELIVERY"] as const;
export type OrderType = (typeof orderTypes)[number];
export const paymentMethods = ["CASH", "GCASH"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentStatus = "UNPAID" | "PAID";
export type OrderSource = "MENU" | "MESSENGER" | "INSTAGRAM" | "WEB_CHAT";
export type CustomerChatMessage = {
  id: string;
  text: string;
  createdAt: string;
};
export type CustomerChat = {
  customerName: string;
  messages: CustomerChatMessage[];
  status: "DRAFT" | "CONFIRMED";
};
export type ChatOrderDraftData = {
  customerName?: string;
  customerPhone?: string;
  orderType?: OrderType;
  tableNumber?: string;
  deliveryAddress?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  items?: {
    productId: string;
    variantId: string | null;
    quantity: number;
    specialInstructions?: string;
  }[];
};
export const chatIntents = [
  "CREATE_ORDER",
  "MODIFY_ORDER",
  "CANCEL_ORDER",
  "ORDER_STATUS",
  "PRODUCT_INQUIRY",
  "STORE_INQUIRY",
  "PAYMENT_INQUIRY",
  "GREETING",
  "OTHER",
] as const;
export type ChatIntent = (typeof chatIntents)[number];
export type LegacyChatIntent = "order_request" | "question" | "other";
export type ChatRoute =
  | "EXTRACT_ORDER"
  | "REVIEW_MODIFICATION"
  | "REVIEW_CANCELLATION"
  | "REVIEW_STATUS"
  | "REVIEW_PRODUCT"
  | "REVIEW_STORE"
  | "REVIEW_PAYMENT"
  | "REVIEW_GREETING"
  | "REVIEW_OTHER"
  | "REVIEW_UNCLEAR";
export type ChatDecision = {
  model: "clef-flash";
  intent: {
    value: ChatIntent | LegacyChatIntent;
    confidence: number;
    probabilities?: Partial<Record<ChatIntent, number>>;
  };
  fulfillment: {
    value: "dine_in" | "pickup" | "delivery" | "unspecified";
    confidence: number;
  };
  payment: { value: "cash" | "gcash" | "unspecified"; confidence: number };
  needsClarificationProbability?: number;
  requiresLLMProbability?: number;
  requiresHumanProbability?: number;
  /** Older stored Clef decisions used this field. */
  missingDetailsProbability?: number;
  analyzedAt: string;
};
export type ChatExtractionReview = {
  model: "gemini-3.5-flash-lite";
  conversationText: string;
  decision: ChatDecision | null;
  needsAttention: boolean;
  suggested: ChatOrderDraftData;
  unmatchedItems: {
    name: string;
    option: string | null;
    quantity: number;
    reason: string;
  }[];
  requestedTime: string | null;
  questions: string[];
};
export type ChatReviewContext = {
  title: string;
  facts: string[];
};
export type ChatOrderDraft = {
  id: string;
  storeId: string;
  source: Exclude<OrderSource, "MENU">;
  conversationText: string;
  draftData: ChatOrderDraftData;
  decision: ChatDecision | null;
  status: "DRAFT" | "CONFIRMED";
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
};
export type ChatOrderDraftSummary = Omit<ChatOrderDraft, "conversationText"> & {
  latestMessage: string | null;
  inboxBucket: "POSSIBLE_ORDER" | "NEEDS_ATTENTION" | "NORMAL";
};
export type PaymentInstructions = {
  gcashAccountName: string;
  gcashNumber: string;
  gcashQrUrl: string | null;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  optionLabel: string | null;
  specialInstructions: string | null;
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export type Order = {
  id: string;
  storeId: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string | null;
  deliveryAddress: string | null;
  tableNumber: string | null;
  trackingToken: string;
  status: OrderStatus;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  source: OrderSource;
  paymentInstructions: PaymentInstructions | null;
  deliveryFee: string | null;
  total: string;
  notes: string | null;
  createdAt: string;
  items?: OrderItem[];
};

export type OwnerOrder = Pick<
  Order,
  | "id"
  | "storeId"
  | "status"
  | "orderType"
  | "paymentMethod"
  | "paymentStatus"
  | "source"
  | "customerName"
  | "customerPhone"
  | "deliveryAddress"
  | "tableNumber"
  | "deliveryFee"
  | "total"
  | "notes"
  | "createdAt"
> & {
  storeName: string;
  subtotal: string;
  items: OrderItem[];
};
