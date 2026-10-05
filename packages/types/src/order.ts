export type OrderStatus =
  "NEW" | "CONFIRMED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED";

export const orderTypes = ["DINE_IN", "PICKUP", "DELIVERY"] as const;
export type OrderType = (typeof orderTypes)[number];

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
