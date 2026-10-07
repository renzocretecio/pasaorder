import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const orderStatusEnum = pgEnum("order_status", [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);

export const orderTypeEnum = pgEnum("order_type", [
  "PICKUP",
  "DELIVERY",
  "DINE_IN",
]);
export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "GCASH"]);
export const paymentStatusEnum = pgEnum("payment_status", ["UNPAID", "PAID"]);
export const orderSourceEnum = pgEnum("order_source", [
  "MENU",
  "MESSENGER",
  "INSTAGRAM",
  "WEB_CHAT",
]);

export const users = pgTable("users", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  tokenVersion: integer("token_version").notNull().default(0),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stores = pgTable("stores", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  ownerId: bigint("owner_id", { mode: "bigint" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 120 }).notNull().unique(),
  description: text("description"),
  contactPhone: varchar("contact_phone", { length: 40 }),
  address: text("address"),
  operatingHours: jsonb("operating_hours"),
  orderTypes: jsonb("order_types")
    .$type<Array<"DINE_IN" | "PICKUP" | "DELIVERY">>()
    .notNull()
    .default(["DINE_IN", "PICKUP", "DELIVERY"]),
  paymentMethods: jsonb("payment_methods")
    .$type<Array<"CASH" | "GCASH">>()
    .notNull()
    .default(["CASH"]),
  gcashAccountName: varchar("gcash_account_name", { length: 120 }),
  gcashNumber: varchar("gcash_number", { length: 40 }),
  gcashQrUrl: text("gcash_qr_url"),
  logoUrl: text("logo_url"),
  bannerUrl: text("banner_url"),
  isActive: boolean("is_active").notNull().default(true),
  isPublished: boolean("is_published").notNull().default(false),
  accentColor: varchar("accent_color", { length: 7 })
    .notNull()
    .default("#244d35"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const ownerPreferences = pgTable("owner_preferences", {
  ownerId: bigint("owner_id", { mode: "bigint" })
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  defaultStoreId: bigint("default_store_id", { mode: "bigint" }).references(
    () => stores.id,
    { onDelete: "set null" },
  ),
});

export const categories = pgTable("categories", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  storeId: bigint("store_id", { mode: "bigint" })
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const products = pgTable("products", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  categoryId: bigint("category_id", { mode: "bigint" })
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  isAvailable: boolean("is_available").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const productVariants = pgTable(
  "product_variants",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    productId: bigint("product_id", { mode: "bigint" })
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    label: varchar("label", { length: 80 }).notNull(),
    price: numeric("price", { precision: 10, scale: 2 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => [index("product_variants_product_id_idx").on(table.productId)],
);

export const orders = pgTable("orders", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  storeId: bigint("store_id", { mode: "bigint" })
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  customerId: bigint("customer_id", { mode: "bigint" }).references(
    () => users.id,
    { onDelete: "restrict" },
  ),
  customerName: varchar("customer_name", { length: 120 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 40 }),
  deliveryAddress: text("delivery_address"),
  tableNumber: varchar("table_number", { length: 40 }),
  trackingToken: varchar("tracking_token", { length: 36 }).notNull().unique(),
  idempotencyKey: varchar("idempotency_key", { length: 36 }).notNull().unique(),
  status: orderStatusEnum("status").notNull().default("NEW"),
  orderType: orderTypeEnum("order_type").notNull().default("PICKUP"),
  paymentMethod: paymentMethodEnum("payment_method").notNull().default("CASH"),
  paymentStatus: paymentStatusEnum("payment_status")
    .notNull()
    .default("UNPAID"),
  source: orderSourceEnum("source").notNull().default("MENU"),
  paymentInstructions: jsonb("payment_instructions"),
  deliveryFee: numeric("delivery_fee", { precision: 10, scale: 2 }),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const chatOrderDrafts = pgTable(
  "chat_order_drafts",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    storeId: bigint("store_id", { mode: "bigint" })
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    source: orderSourceEnum("source").notNull(),
    conversationText: text("conversation_text").notNull(),
    draftData: jsonb("draft_data").notNull().default({}),
    decision: jsonb("decision"),
    accessTokenHash: varchar("access_token_hash", { length: 64 }).unique(),
    providerConversationId: varchar("provider_conversation_id", {
      length: 255,
    }),
    chatMessages: jsonb("chat_messages").notNull().default([]),
    status: varchar("status", { length: 16 }).notNull().default("DRAFT"),
    orderId: bigint("order_id", { mode: "bigint" }).references(
      () => orders.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("chat_order_drafts_store_status_idx").on(table.storeId, table.status),
    uniqueIndex("chat_order_drafts_external_active_idx")
      .on(table.storeId, table.providerConversationId)
      .where(
        sql`${table.providerConversationId} IS NOT NULL AND ${table.status} = 'DRAFT'`,
      ),
  ],
);

export const metaPageConnections = pgTable("meta_page_connections", {
  storeId: bigint("store_id", { mode: "bigint" })
    .primaryKey()
    .references(() => stores.id, { onDelete: "cascade" }),
  pageId: varchar("page_id", { length: 64 }).notNull().unique(),
  pageName: varchar("page_name", { length: 255 }).notNull(),
  encryptedPageAccessToken: text("encrypted_page_access_token").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const metaOauthSessions = pgTable("meta_oauth_sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  storeId: bigint("store_id", { mode: "bigint" })
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  ownerId: bigint("owner_id", { mode: "bigint" })
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  pages: jsonb("pages").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  orderId: bigint("order_id", { mode: "bigint" })
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: bigint("product_id", { mode: "bigint" })
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  optionLabel: varchar("option_label", { length: 80 }),
  specialInstructions: varchar("special_instructions", { length: 500 }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  stores: many(stores),
  orders: many(orders),
}));

export const storesRelations = relations(stores, ({ one, many }) => ({
  owner: one(users, {
    fields: [stores.ownerId],
    references: [users.id],
  }),
  categories: many(categories),
  orders: many(orders),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  store: one(stores, {
    fields: [categories.storeId],
    references: [stores.id],
  }),
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  orderItems: many(orderItems),
  variants: many(productVariants),
}));

export const productVariantsRelations = relations(
  productVariants,
  ({ one }) => ({
    product: one(products, {
      fields: [productVariants.productId],
      references: [products.id],
    }),
  }),
);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  store: one(stores, {
    fields: [orders.storeId],
    references: [stores.id],
  }),
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const schema = {
  users,
  stores,
  categories,
  products,
  productVariants,
  orders,
  orderItems,
  chatOrderDrafts,
};
