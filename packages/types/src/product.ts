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
  description: string | null;
  price: string;
  variants: ProductVariant[];
  imageUrl: string | null;
  isAvailable: boolean;
  sortOrder: number;
  createdAt: string;
};
