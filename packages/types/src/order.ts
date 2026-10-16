import type { StoreOrderAnswer } from "./catalog.js";
import type { ProductType } from "./product.js";

export type OrderStatus =
  "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

export const orderWorkflowStatuses = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[];
export type OrderWorkflowTemplate = "STANDARD" | "FOOD" | "RETAIL" | "CUSTOM";
export type OrderWorkflow = {
  template: OrderWorkflowTemplate;
  labels: Record<OrderStatus, string>;
};
export const orderWorkflowTemplates: Record<
  OrderWorkflowTemplate,
  OrderWorkflow
> = {
  STANDARD: {
    template: "STANDARD",
    labels: {
      NEW: "New",
      CONFIRMED: "Confirmed",
      PREPARING: "Preparing",
      READY: "Ready",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    },
  },
  FOOD: {
    template: "FOOD",
    labels: {
      NEW: "New",
      CONFIRMED: "Accepted",
      PREPARING: "Preparing",
      READY: "Ready for pickup",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    },
  },
  RETAIL: {
    template: "RETAIL",
    labels: {
      NEW: "New",
      CONFIRMED: "Confirmed",
      PREPARING: "Packing",
      READY: "Shipped",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    },
  },
  CUSTOM: {
    template: "CUSTOM",
    labels: {
      NEW: "New",
      CONFIRMED: "Confirmed",
      PREPARING: "In progress",
      READY: "Ready",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    },
  },
};

export const orderTypes = ["DINE_IN", "PICKUP", "DELIVERY"] as const;
export type OrderType = (typeof orderTypes)[number];
export const paymentMethods = ["CASH", "GCASH"] as const;
export type PaymentMethod = (typeof paymentMethods)[number];
export type PaymentStatus = "UNPAID" | "PAID";
export type OrderSource =
  "MENU" | "MANUAL" | "MESSENGER" | "INSTAGRAM" | "WEB_CHAT";
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
  productType: ProductType;
  optionLabel: string | null;
  specialInstructions: string | null;
  addOns: { groupName: string; optionName: string; price: string }[];
  productAnswers: StoreOrderAnswer[];
  quantity: number;
  unitPrice: string;
  subtotal: string;
};

export type OrderAttachment = {
  id: string;
  orderId: string;
  orderItemId: string | null;
  questionId: string;
  questionLabel: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export type PaymentProof = {
  id: string;
  fileName: string;
  contentType: "image/webp";
  sizeBytes: number;
  createdAt: string;
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
  scheduledFor: string | null;
  total: string;
  notes: string | null;
  formAnswers?: StoreOrderAnswer[];
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
  | "scheduledFor"
  | "total"
  | "notes"
  | "formAnswers"
  | "createdAt"
> & {
  storeName: string;
  subtotal: string;
  items: OrderItem[];
  attachments: OrderAttachment[];
  paymentProof: PaymentProof | null;
};

export type PastOrdersPage = {
  orders: OwnerOrder[];
  nextCursor: string | null;
  totalCount: number;
  unpaidCount: number;
};

export type StoreOverview = {
  generatedAt: string;
  date: string;
  from: string;
  to: string;
  sales: string;
  ordersCount: number;
  activeOrders: number;
  awaitingConfirmation: number;
  salesTrend: { date: string; sales: string }[];
  topProducts: {
    productId: string;
    name: string;
    units: number;
    revenue: string;
  }[];
};
