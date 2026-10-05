import type { Product } from "./product.js";
import type { OrderType, PaymentMethod } from "./order.js";
export const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type Weekday = (typeof weekdays)[number];
export type OperatingHours = {
  day: Weekday;
  open: boolean;
  opens: string;
  closes: string;
}[];
export type CatalogStore = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  contactPhone: string | null;
  address: string | null;
  operatingHours: OperatingHours | null;
  orderTypes: OrderType[];
  paymentMethods: PaymentMethod[];
  gcashAccountName: string | null;
  gcashNumber: string | null;
  gcashQrUrl: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isActive: boolean;
  isPublished: boolean;
  accentColor: string;
};
export type WorkspaceStore = CatalogStore & { isDefault: boolean };
export type CatalogCategory = {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  items: Product[];
};
export type Catalog = { store: CatalogStore; categories: CatalogCategory[] };
