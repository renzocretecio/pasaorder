import type { StoreOrderQuestion } from "./catalog.js";

export type ProductAddonOption = {
  id: string;
  name: string;
  price: string;
};

export type ProductAddonGroup = {
  id: string;
  name: string;
  selection: "SINGLE" | "MULTIPLE";
  required: boolean;
  options: ProductAddonOption[];
};

export type SelectedProductAddon = {
  groupId: string;
  optionId: string;
};

export type ProductVariant = {
  id: string;
  productId: string;
  label: string;
  price: string;
  sortOrder: number;
};

export type Product = {
  id: string;
  categoryId: string;
  name: string;
  productType: ProductType;
  description: string | null;
  price: string;
  quantityUnit: QuantityUnit;
  variants: ProductVariant[];
  addOnGroups: ProductAddonGroup[];
  orderQuestions: StoreOrderQuestion[];
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
};
export const quantityUnits = ["EACH", "KG"] as const;
export type QuantityUnit = (typeof quantityUnits)[number];
export const productTypes = ["PHYSICAL", "MADE_TO_ORDER", "SERVICE"] as const;
export type ProductType = (typeof productTypes)[number];
