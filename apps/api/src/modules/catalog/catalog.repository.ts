import type { PoolClient } from "pg";
import type {
  Catalog,
  CatalogStore,
  CatalogCategory,
  Product,
  ProductVariant,
  ProductAddonGroup,
  StoreOrderQuestion,
  WorkspaceStore,
} from "@pasaorder/types";
import type { CatalogImportInput } from "@pasaorder/validation";
import { pool } from "../../db.js";
import { AppError } from "../../middleware/errors.js";
const storeFields = `s.id, s.name, s.business_category AS "businessCategory", s.slug, s.description, s.contact_phone AS "contactPhone", s.address, s.operating_hours AS "operatingHours", s.order_types AS "orderTypes", s.payment_methods AS "paymentMethods", s.gcash_account_name AS "gcashAccountName", s.gcash_number AS "gcashNumber", s.gcash_qr_url AS "gcashQrUrl", s.logo_url AS "logoUrl", s.banner_url AS "bannerUrl", s.is_active AS "isActive", s.is_published AS "isPublished", s.accent_color AS "accentColor", s.order_questions AS "orderQuestions", s.order_workflow AS "orderWorkflow"`;
export async function transaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function ownedStore(
  client: PoolClient,
  id: string,
  ownerId: string,
) {
  const result = await client.query<CatalogStore>(
    `SELECT ${storeFields} FROM stores s WHERE s.id = $1 AND s.owner_id = $2 FOR UPDATE OF s`,
    [id, ownerId],
  );
  if (!result.rows[0]) throw new AppError(404, "Store not found");
  return result.rows[0];
}
export async function listCatalogStores(ownerId: string) {
  return (
    await pool.query<WorkspaceStore>(
      `SELECT ${storeFields}, COALESCE(op.default_store_id, (SELECT preferred.id FROM stores preferred WHERE preferred.owner_id = s.owner_id ORDER BY preferred.created_at DESC, preferred.id DESC LIMIT 1)) = s.id AS "isDefault" FROM stores s LEFT JOIN owner_preferences op ON op.owner_id = s.owner_id WHERE s.owner_id = $1 ORDER BY s.created_at DESC, s.id DESC`,
      [ownerId],
    )
  ).rows;
}
export async function listPublishedStoreSlugs() {
  return (
    await pool.query<{ slug: string }>(
      `SELECT slug FROM stores WHERE is_active = true AND is_published = true ORDER BY slug`,
    )
  ).rows;
}
export async function readCatalog(
  key: string,
  ownerId?: string,
): Promise<Catalog> {
  const result = await pool.query<CatalogStore>(
    `SELECT ${storeFields} FROM stores s WHERE ${ownerId ? "s.id = $1 AND s.owner_id = $2" : "s.slug = $1 AND s.is_active = true AND s.is_published = true"}`,
    ownerId ? [key, ownerId] : [key],
  );
  const store = result.rows[0];
  if (!store) throw new AppError(404, "Menu not found");
  const cats = await pool.query<Omit<CatalogCategory, "items">>(
    `SELECT id, store_id AS "storeId", name, sort_order AS "sortOrder" FROM categories WHERE store_id = $1 ORDER BY sort_order, id`,
    [store.id],
  );
  const rows = await pool.query<
    Omit<Product, "createdAt" | "variants"> & { createdAt: Date }
  >(
    `SELECT p.id, p.category_id AS "categoryId", p.name, p.product_type AS "productType", p.description, p.add_on_groups AS "addOnGroups", p.order_questions AS "orderQuestions", p.price, p.image_url AS "imageUrl", p.is_available AS "isAvailable", p.sort_order AS "sortOrder", p.created_at AS "createdAt" FROM products p JOIN categories c ON c.id = p.category_id WHERE c.store_id = $1 ORDER BY p.sort_order, p.id`,
    [store.id],
  );
  const variants = rows.rows.length
    ? (
        await pool.query<ProductVariant>(
          `SELECT id, product_id AS "productId", label, price, sort_order AS "sortOrder" FROM product_variants WHERE product_id = ANY($1::bigint[]) ORDER BY sort_order, id`,
          [rows.rows.map((item) => item.id)],
        )
      ).rows
    : [];
  const variantsByProduct = new Map<string, ProductVariant[]>();
  for (const variant of variants) {
    const group = variantsByProduct.get(variant.productId) ?? [];
    group.push(variant);
    variantsByProduct.set(variant.productId, group);
  }
  return {
    store,
    categories: cats.rows.map((category) => ({
      ...category,
      items: rows.rows
        .filter((item) => item.categoryId === category.id)
        .map((item) => ({
          ...item,
          variants: variantsByProduct.get(item.id) ?? [],
          createdAt: item.createdAt.toISOString(),
        })),
    })),
  };
}
export type StoreInput = {
  name: string;
  businessCategory: CatalogStore["businessCategory"];
  description: string;
  contactPhone: string;
  address: string;
  operatingHours: CatalogStore["operatingHours"];
  orderTypes: CatalogStore["orderTypes"];
  paymentMethods: CatalogStore["paymentMethods"];
  gcashAccountName: string;
  gcashNumber: string;
  gcashQrUrl: string;
  logoUrl: string;
  bannerUrl: string;
  accentColor: string;
  orderQuestions: StoreOrderQuestion[];
  orderWorkflow: CatalogStore["orderWorkflow"];
};
export async function setupStore(
  input: StoreInput & {
    slug: string;
  },
  ownerId: string,
) {
  const store = await pool.query<{ id: string }>(
    `WITH new_store AS (INSERT INTO stores (owner_id, name, business_category, slug, description, logo_url, accent_color, contact_phone, address, operating_hours, order_types, banner_url, payment_methods, gcash_account_name, gcash_number, gcash_qr_url, order_questions, order_workflow, is_published) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14,$15,$16,$17::jsonb,$18::jsonb,false) RETURNING id), default_preference AS (INSERT INTO owner_preferences (owner_id, default_store_id) SELECT $1, id FROM new_store ON CONFLICT (owner_id) DO NOTHING RETURNING owner_id) SELECT id FROM new_store`,
    [
      ownerId,
      input.name,
      input.businessCategory,
      input.slug,
      input.description || null,
      input.logoUrl || null,
      input.accentColor,
      input.contactPhone || null,
      input.address || null,
      input.operatingHours ? JSON.stringify(input.operatingHours) : null,
      JSON.stringify(input.orderTypes),
      input.bannerUrl || null,
      JSON.stringify(input.paymentMethods),
      input.paymentMethods.includes("GCASH") ? input.gcashAccountName : null,
      input.paymentMethods.includes("GCASH") ? input.gcashNumber : null,
      input.paymentMethods.includes("GCASH") ? input.gcashQrUrl || null : null,
      JSON.stringify(input.orderQuestions),
      JSON.stringify(input.orderWorkflow),
    ],
  );
  return { id: store.rows[0].id };
}

export async function setDefaultStore(storeId: string, ownerId: string) {
  const result = await pool.query(
    `INSERT INTO owner_preferences (owner_id, default_store_id) SELECT $1, s.id FROM stores s WHERE s.id = $2 AND s.owner_id = $1 ON CONFLICT (owner_id) DO UPDATE SET default_store_id = EXCLUDED.default_store_id RETURNING owner_id`,
    [ownerId, storeId],
  );
  if (!result.rowCount) throw new AppError(404, "Store not found");
}
export async function settings(id: string, input: StoreInput, ownerId: string) {
  return transaction(async (client) => {
    await ownedStore(client, id, ownerId);
    await client.query(
      "UPDATE stores SET name=$2, business_category=$3, description=$4, logo_url=$5, accent_color=$6, contact_phone=$7, address=$8, operating_hours=$9::jsonb, banner_url=$10, order_types=$11::jsonb, payment_methods=$12::jsonb, gcash_account_name=$13, gcash_number=$14, gcash_qr_url=$15, order_questions=$16::jsonb, order_workflow=$17::jsonb WHERE id=$1",
      [
        id,
        input.name,
        input.businessCategory,
        input.description || null,
        input.logoUrl || null,
        input.accentColor,
        input.contactPhone || null,
        input.address || null,
        input.operatingHours ? JSON.stringify(input.operatingHours) : null,
        input.bannerUrl || null,
        JSON.stringify(input.orderTypes),
        JSON.stringify(input.paymentMethods),
        input.paymentMethods.includes("GCASH") ? input.gcashAccountName : null,
        input.paymentMethods.includes("GCASH") ? input.gcashNumber : null,
        input.paymentMethods.includes("GCASH")
          ? input.gcashQrUrl || null
          : null,
        JSON.stringify(input.orderQuestions),
        JSON.stringify(input.orderWorkflow),
      ],
    );
  });
}
export async function saveCategory(
  id: string,
  categoryId: string | undefined,
  input: { name: string; sortOrder: number },
  ownerId: string,
) {
  return transaction(async (client) => {
    await ownedStore(client, id, ownerId);
    if (categoryId) {
      const result = await client.query(
        "UPDATE categories SET name=$3, sort_order=$4 WHERE id=$1 AND store_id=$2 RETURNING id",
        [categoryId, id, input.name, input.sortOrder],
      );
      if (!result.rows[0]) throw new AppError(404, "Category not found");
      return result.rows[0];
    }
    return (
      await client.query(
        "INSERT INTO categories (store_id,name,sort_order) VALUES ($1,$2,$3) RETURNING id",
        [id, input.name, input.sortOrder],
      )
    ).rows[0];
  });
}
export type ItemInput = {
  categoryId: string;
  name: string;
  productType: Product["productType"];
  description: string;
  price?: string;
  variants: { id?: string; label: string; price: string }[];
  addOnGroups: ProductAddonGroup[];
  orderQuestions: Product["orderQuestions"];
  imageUrl: string;
  isAvailable: boolean;
  sortOrder: number;
};
export async function importItems(
  storeId: string,
  input: CatalogImportInput,
  ownerId: string,
) {
  return transaction(async (client) => {
    await ownedStore(client, storeId, ownerId);
    const existingCategories = await client.query<{
      id: string;
      name: string;
      sortOrder: number;
      nextItemOrder: number;
    }>(
      `SELECT c.id, c.name, c.sort_order AS "sortOrder", COALESCE(MAX(p.sort_order), -1)::int + 1 AS "nextItemOrder"
       FROM categories c LEFT JOIN products p ON p.category_id = c.id
       WHERE c.store_id = $1 GROUP BY c.id ORDER BY c.sort_order, c.id`,
      [storeId],
    );
    const categoryKey = (value: string) => value.trim().toLocaleLowerCase();
    const productKey = (category: string, name: string) =>
      JSON.stringify([categoryKey(category), name.trim().toLocaleLowerCase()]);
    const categories = new Map(
      existingCategories.rows.map((category) => [
        categoryKey(category.name),
        category,
      ]),
    );
    const existingProducts = await client.query<{
      category: string;
      name: string;
    }>(
      `SELECT c.name AS category, p.name FROM products p JOIN categories c ON c.id = p.category_id WHERE c.store_id = $1`,
      [storeId],
    );
    const names = new Set(
      existingProducts.rows.map((item) => productKey(item.category, item.name)),
    );
    for (const item of input.items) {
      const key = productKey(item.category, item.name);
      if (names.has(key))
        throw new AppError(
          409,
          `Row ${item.row}: ${item.name} already exists in ${item.category}.`,
        );
      names.add(key);
    }
    let nextCategoryOrder = Math.max(
      0,
      ...existingCategories.rows.map((category) => category.sortOrder + 1),
    );
    let createdCategories = 0;
    for (const item of input.items) {
      const key = categoryKey(item.category);
      let category = categories.get(key);
      if (!category) {
        const result = await client.query<{ id: string }>(
          "INSERT INTO categories (store_id,name,sort_order) VALUES ($1,$2,$3) RETURNING id",
          [storeId, item.category, nextCategoryOrder],
        );
        category = {
          id: result.rows[0].id,
          name: item.category,
          sortOrder: nextCategoryOrder++,
          nextItemOrder: 0,
        };
        categories.set(key, category);
        createdCategories++;
      }
      const price = item.variants.length
        ? item.variants.reduce(
            (lowest, variant) =>
              Number(variant.price) < Number(lowest) ? variant.price : lowest,
            item.variants[0].price,
          )
        : item.price!;
      const result = await client.query<{ id: string }>(
        `INSERT INTO products (category_id,name,product_type,description,price,image_url,is_available,sort_order)
         VALUES ($1,$2,'PHYSICAL',$3,$4,NULL,$5,$6) RETURNING id`,
        [
          category.id,
          item.name,
          item.description || null,
          price,
          item.isAvailable,
          category.nextItemOrder++,
        ],
      );
      await saveVariants(client, result.rows[0].id, item.variants, false);
    }
    return { imported: input.items.length, createdCategories };
  });
}
export async function saveItem(
  id: string,
  itemId: string | undefined,
  input: ItemInput,
  ownerId: string,
) {
  return transaction(async (client) => {
    await ownedStore(client, id, ownerId);
    const category = await client.query(
      "SELECT id FROM categories WHERE id=$1 AND store_id=$2",
      [input.categoryId, id],
    );
    if (!category.rows[0]) throw new AppError(404, "Category not found");
    const price = input.variants.length
      ? input.variants.reduce(
          (lowest, variant) =>
            Number(variant.price) < Number(lowest) ? variant.price : lowest,
          input.variants[0].price,
        )
      : input.price!;
    const values = [
      input.categoryId,
      input.name,
      input.productType,
      input.description || null,
      price,
      input.imageUrl || null,
      input.isAvailable,
      input.sortOrder,
    ];
    if (itemId) {
      const result = await client.query(
        `UPDATE products SET category_id=$1,name=$2,product_type=$3,description=$4,price=$5,image_url=$6,is_available=$7,sort_order=$8,add_on_groups=$9::jsonb,order_questions=$10::jsonb WHERE id=$11 AND category_id IN (SELECT id FROM categories WHERE store_id=$12) RETURNING id`,
        [
          ...values,
          JSON.stringify(input.addOnGroups),
          JSON.stringify(input.orderQuestions),
          itemId,
          id,
        ],
      );
      if (!result.rows[0]) throw new AppError(404, "Item not found");
      await saveVariants(client, itemId, input.variants, true);
      if (!input.isAvailable) await unpublishIfEmpty(client, id);
      return result.rows[0];
    }
    const item = (
      await client.query<{ id: string }>(
        `INSERT INTO products (category_id,name,product_type,description,price,image_url,is_available,sort_order,add_on_groups,order_questions) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb) RETURNING id`,
        [
          ...values,
          JSON.stringify(input.addOnGroups),
          JSON.stringify(input.orderQuestions),
        ],
      )
    ).rows[0];
    await saveVariants(client, item.id, input.variants, false);
    return item;
  });
}
async function saveVariants(
  client: PoolClient,
  productId: string,
  variants: ItemInput["variants"],
  editing: boolean,
) {
  const existing = editing
    ? (
        await client.query<{ id: string }>(
          "SELECT id FROM product_variants WHERE product_id=$1 FOR UPDATE",
          [productId],
        )
      ).rows
    : [];
  const existingIds = new Set(existing.map((variant) => variant.id));
  const keptIds = variants.flatMap((variant) =>
    variant.id ? [variant.id] : [],
  );
  if (
    keptIds.some((id) => !existingIds.has(id)) ||
    new Set(keptIds).size !== keptIds.length
  )
    throw new AppError(404, "Option not found");
  await client.query(
    "DELETE FROM product_variants WHERE product_id=$1 AND NOT (id = ANY($2::bigint[]))",
    [productId, keptIds],
  );
  for (const [index, variant] of variants.entries()) {
    if (variant.id)
      await client.query(
        "UPDATE product_variants SET label=$3, price=$4, sort_order=$5 WHERE id=$1 AND product_id=$2",
        [variant.id, productId, variant.label, variant.price, index],
      );
    else
      await client.query(
        "INSERT INTO product_variants (product_id,label,price,sort_order) VALUES ($1,$2,$3,$4)",
        [productId, variant.label, variant.price, index],
      );
  }
}
async function unpublishIfEmpty(client: PoolClient, id: string) {
  await client.query(
    "UPDATE stores SET is_published=false WHERE id=$1 AND NOT EXISTS (SELECT 1 FROM products p JOIN categories c ON c.id=p.category_id WHERE c.store_id=$1 AND p.is_available=true)",
    [id],
  );
}
export async function publish(
  id: string,
  isPublished: boolean,
  ownerId: string,
) {
  return transaction(async (client) => {
    const store = await ownedStore(client, id, ownerId);
    if (isPublished) {
      if (!store.isActive)
        throw new AppError(400, "Activate this store before publishing");
      const items = await client.query(
        "SELECT 1 FROM products p JOIN categories c ON c.id=p.category_id WHERE c.store_id=$1 AND p.is_available=true LIMIT 1",
        [id],
      );
      if (!items.rows[0])
        throw new AppError(
          400,
          "Add at least one available item before publishing",
        );
    }
    await client.query("UPDATE stores SET is_published=$2 WHERE id=$1", [
      id,
      isPublished,
    ]);
  });
}

export async function reorderCatalog(
  id: string,
  input: {
    categoryIds: string[];
    items: { categoryId: string; itemIds: string[] }[];
  },
  ownerId: string,
) {
  return transaction(async (client) => {
    await ownedStore(client, id, ownerId);
    const categories = await client.query<{ id: string }>(
      "SELECT id FROM categories WHERE store_id=$1 FOR UPDATE",
      [id],
    );
    const actualCategoryIds = new Set(categories.rows.map(({ id }) => id));
    if (
      input.categoryIds.length !== actualCategoryIds.size ||
      input.categoryIds.some((categoryId) => !actualCategoryIds.has(categoryId))
    )
      throw new AppError(409, "Catalog changed. Reload and try again.");

    const itemOrders = new Map(
      input.items.map(({ categoryId, itemIds }) => [categoryId, itemIds]),
    );
    if (itemOrders.size !== actualCategoryIds.size)
      throw new AppError(409, "Catalog changed. Reload and try again.");

    for (const [sortOrder, categoryId] of input.categoryIds.entries())
      await client.query(
        "UPDATE categories SET sort_order=$3 WHERE id=$1 AND store_id=$2",
        [categoryId, id, sortOrder],
      );

    for (const categoryId of input.categoryIds) {
      const actualItems = await client.query<{ id: string }>(
        "SELECT id FROM products WHERE category_id=$1 FOR UPDATE",
        [categoryId],
      );
      const actualItemIds = new Set(actualItems.rows.map(({ id }) => id));
      const itemIds = itemOrders.get(categoryId);
      if (
        !itemIds ||
        itemIds.length !== actualItemIds.size ||
        itemIds.some((itemId) => !actualItemIds.has(itemId))
      )
        throw new AppError(409, "Catalog changed. Reload and try again.");
      for (const [sortOrder, itemId] of itemIds.entries())
        await client.query(
          "UPDATE products SET sort_order=$3 WHERE id=$1 AND category_id=$2",
          [itemId, categoryId, sortOrder],
        );
    }
  });
}
