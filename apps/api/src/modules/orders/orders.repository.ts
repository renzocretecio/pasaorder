import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { pool } from "../../db.js";
import { AppError } from "../../middleware/errors.js";
import { transaction } from "../catalog/catalog.repository.js";

type OrderInput = {
  storeSlug: string;
  idempotencyKey: string;
  customerName: string;
  customerPhone?: string;
  orderType: "DINE_IN" | "PICKUP" | "DELIVERY";
  paymentMethod: "CASH" | "GCASH";
  tableNumber?: string;
  deliveryAddress?: string;
  notes?: string;
  items: {
    productId: string;
    variantId: string | null;
    quantity: number;
    specialInstructions?: string;
  }[];
};

function cents(price: string) {
  const [whole, fraction = ""] = price.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function amount(value: number) {
  return (value / 100).toFixed(2);
}

async function readCreatedOrder(client: PoolClient, trackingToken: string) {
  const order = await client.query(
    `SELECT id, store_id AS "storeId", status, order_type AS "orderType", table_number AS "tableNumber", delivery_fee AS "deliveryFee", total, tracking_token AS "trackingToken", payment_method AS "paymentMethod", payment_status AS "paymentStatus", payment_instructions AS "paymentInstructions" FROM orders WHERE tracking_token = $1`,
    [trackingToken],
  );
  return order.rows[0];
}

export async function createPublicOrder(input: OrderInput) {
  return transaction(async (client) => {
    const existing = await client.query<{ trackingToken: string }>(
      `SELECT tracking_token AS "trackingToken" FROM orders WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );
    if (existing.rows[0])
      return {
        order: await readCreatedOrder(client, existing.rows[0].trackingToken),
        created: false,
      };

    const storeResult = await client.query<{
      id: string;
      orderTypes: string[];
      paymentMethods: string[];
      gcashAccountName: string | null;
      gcashNumber: string | null;
      gcashQrUrl: string | null;
    }>(
      `SELECT id, order_types AS "orderTypes", payment_methods AS "paymentMethods", gcash_account_name AS "gcashAccountName", gcash_number AS "gcashNumber", gcash_qr_url AS "gcashQrUrl" FROM stores WHERE slug = $1 AND is_active = true AND is_published = true FOR SHARE`,
      [input.storeSlug],
    );
    const store = storeResult.rows[0];
    if (!store) throw new AppError(404, "Menu not found");
    if (!store.orderTypes.includes(input.orderType))
      throw new AppError(400, "This order type is not available at this store");
    if (!store.paymentMethods.includes(input.paymentMethod))
      throw new AppError(
        400,
        "This payment method is not available at this store",
      );
    const paymentInstructions =
      input.paymentMethod === "GCASH"
        ? {
            gcashAccountName: store.gcashAccountName!,
            gcashNumber: store.gcashNumber!,
            gcashQrUrl: store.gcashQrUrl,
          }
        : null;

    const orderItems: {
      productId: string;
      productName: string;
      optionLabel: string | null;
      specialInstructions: string | null;
      quantity: number;
      unitPrice: string;
      subtotal: string;
    }[] = [];
    let totalCents = 0;
    for (const line of input.items) {
      const product = await client.query<{
        id: string;
        name: string;
        price: string;
        isAvailable: boolean;
        variantId: string | null;
        variantLabel: string | null;
        variantPrice: string | null;
        hasVariants: boolean;
      }>(
        `SELECT p.id, p.name, p.price, p.is_available AS "isAvailable", v.id AS "variantId", v.label AS "variantLabel", v.price AS "variantPrice", EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id) AS "hasVariants" FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN product_variants v ON v.product_id = p.id AND v.id = $3 WHERE p.id = $1 AND c.store_id = $2`,
        [line.productId, store.id, line.variantId],
      );
      const item = product.rows[0];
      if (!item || !item.isAvailable)
        throw new AppError(
          400,
          "One of the selected items is no longer available. Refresh the menu and try again.",
        );
      if (
        (item.variantId ?? null) !== line.variantId ||
        (item.hasVariants && !line.variantId)
      )
        throw new AppError(
          400,
          "A selected option is no longer available. Refresh the menu and try again.",
        );
      const unitPrice = item.variantPrice ?? item.price;
      const lineCents = cents(unitPrice) * line.quantity;
      totalCents += lineCents;
      orderItems.push({
        productId: item.id,
        productName: item.name,
        optionLabel: item.variantLabel,
        specialInstructions: line.specialInstructions || null,
        quantity: line.quantity,
        unitPrice,
        subtotal: amount(lineCents),
      });
    }

    const trackingToken = randomUUID();
    const created = await client.query<{ id: string }>(
      `INSERT INTO orders (store_id, customer_id, customer_name, customer_phone, delivery_address, order_type, table_number, payment_method, payment_status, payment_instructions, delivery_fee, total, notes, tracking_token, idempotency_key) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'UNPAID', $8::jsonb, NULL, $9, $10, $11, $12) RETURNING id`,
      [
        store.id,
        input.customerName,
        input.customerPhone || null,
        input.deliveryAddress || null,
        input.orderType,
        input.orderType === "DINE_IN" ? input.tableNumber || null : null,
        input.paymentMethod,
        paymentInstructions ? JSON.stringify(paymentInstructions) : null,
        amount(totalCents),
        input.notes || null,
        trackingToken,
        input.idempotencyKey,
      ],
    );
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, option_label, special_instructions, quantity, unit_price, subtotal) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          created.rows[0].id,
          item.productId,
          item.productName,
          item.optionLabel,
          item.specialInstructions,
          item.quantity,
          item.unitPrice,
          item.subtotal,
        ],
      );
    }
    return {
      order: await readCreatedOrder(client, trackingToken),
      created: true,
    };
  });
}

export async function getPublicOrder(trackingToken: string) {
  const result = await pool.query(
    `SELECT o.id, o.store_id AS "storeId", s.name AS "storeName", s.slug AS "storeSlug", o.status, o.order_type AS "orderType", o.table_number AS "tableNumber", o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus", o.payment_instructions AS "paymentInstructions", COALESCE((SELECT SUM(oi.subtotal) FROM order_items oi WHERE oi.order_id = o.id), 0)::text AS "itemsSubtotal", o.total, o.delivery_fee AS "deliveryFee", o.created_at AS "createdAt" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.tracking_token = $1`,
    [trackingToken],
  );
  if (!result.rows[0]) throw new AppError(404, "Order not found");
  const items = await pool.query(
    `SELECT product_name AS "productName", option_label AS "optionLabel", quantity, unit_price AS "unitPrice", subtotal FROM order_items WHERE order_id = $1 ORDER BY id`,
    [result.rows[0].id],
  );
  return { ...result.rows[0], items: items.rows };
}

export async function listOwnerOrders(ownerId: string, storeId?: string) {
  const result = await pool.query<{
    id: string;
    storeId: string;
    storeName: string;
    status: string;
    orderType: string;
    paymentMethod: "CASH" | "GCASH";
    paymentStatus: "UNPAID" | "PAID";
    paymentInstructions: {
      gcashAccountName: string;
      gcashNumber: string;
      gcashQrUrl: string | null;
    } | null;
    tableNumber: string | null;
    customerName: string;
    customerPhone: string | null;
    deliveryAddress: string | null;
    deliveryFee: string | null;
    subtotal: string;
    total: string;
    notes: string | null;
    createdAt: Date;
  }>(
    `SELECT o.id, o.store_id AS "storeId", s.name AS "storeName", o.status, o.order_type AS "orderType", o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus", o.table_number AS "tableNumber", o.customer_name AS "customerName", o.customer_phone AS "customerPhone", o.delivery_address AS "deliveryAddress", o.delivery_fee AS "deliveryFee", COALESCE(SUM(oi.subtotal), 0)::text AS subtotal, o.total::text AS total, o.notes, o.created_at AS "createdAt" FROM orders o JOIN stores s ON s.id = o.store_id LEFT JOIN order_items oi ON oi.order_id = o.id WHERE s.owner_id = $1 AND ($2::bigint IS NULL OR o.store_id = $2) GROUP BY o.id, s.name ORDER BY CASE o.status WHEN 'NEW' THEN 0 WHEN 'CONFIRMED' THEN 1 WHEN 'PREPARING' THEN 2 WHEN 'READY' THEN 3 ELSE 4 END, CASE WHEN o.status IN ('COMPLETED', 'CANCELLED') THEN o.created_at END DESC, o.created_at ASC LIMIT 300`,
    [ownerId, storeId ?? null],
  );
  const orders = result.rows;
  const itemResult = orders.length
    ? await pool.query<{
        id: string;
        orderId: string;
        productName: string;
        optionLabel: string | null;
        specialInstructions: string | null;
        quantity: number;
        unitPrice: string;
        subtotal: string;
      }>(
        `SELECT id, order_id AS "orderId", product_name AS "productName", option_label AS "optionLabel", special_instructions AS "specialInstructions", quantity, unit_price AS "unitPrice", subtotal FROM order_items WHERE order_id = ANY($1::bigint[]) ORDER BY id`,
        [orders.map((order) => order.id)],
      )
    : { rows: [] };
  const itemsByOrder = new Map<string, typeof itemResult.rows>();
  for (const item of itemResult.rows) {
    const items = itemsByOrder.get(item.orderId) ?? [];
    items.push(item);
    itemsByOrder.set(item.orderId, items);
  }
  return orders.map((order) => ({
    ...order,
    createdAt: order.createdAt.toISOString(),
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

export async function updateOwnerOrderPayment(
  ownerId: string,
  orderId: string,
  paymentStatus: "UNPAID" | "PAID",
) {
  return transaction(async (client) => {
    const result = await client.query<{
      storeId: string;
      orderType: string;
      deliveryFee: string | null;
    }>(
      `SELECT o.store_id AS "storeId", o.order_type AS "orderType", o.delivery_fee AS "deliveryFee" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = $1 AND s.owner_id = $2 FOR UPDATE OF o`,
      [orderId, ownerId],
    );
    const order = result.rows[0];
    if (!order) throw new AppError(404, "Order not found");
    if (
      paymentStatus === "PAID" &&
      order.orderType === "DELIVERY" &&
      order.deliveryFee === null
    )
      throw new AppError(
        409,
        "Confirm the delivery fee before marking payment as paid",
      );
    await client.query(`UPDATE orders SET payment_status = $2 WHERE id = $1`, [
      orderId,
      paymentStatus,
    ]);
    return { storeId: order.storeId };
  });
}

export async function updateOwnerOrder(
  ownerId: string,
  orderId: string,
  input: { status: string; deliveryFee?: string },
) {
  return transaction(async (client) => {
    const result = await client.query<{
      storeId: string;
      status: string;
      orderType: string;
      deliveryFee: string | null;
    }>(
      `SELECT o.store_id AS "storeId", o.status, o.order_type AS "orderType", o.delivery_fee AS "deliveryFee" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = $1 AND s.owner_id = $2 FOR UPDATE OF o`,
      [orderId, ownerId],
    );
    const order = result.rows[0];
    if (!order) throw new AppError(404, "Order not found");

    const nextStatuses: Record<string, string[]> = {
      NEW: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!nextStatuses[order.status]?.includes(input.status))
      throw new AppError(
        409,
        "This order has already changed. Refresh and try again.",
      );
    if (
      order.status === "NEW" &&
      input.status === "CONFIRMED" &&
      order.orderType === "DELIVERY" &&
      input.deliveryFee === undefined
    )
      throw new AppError(
        400,
        "Enter the delivery fee before confirming this order",
      );
    if (
      input.deliveryFee !== undefined &&
      !(
        order.status === "NEW" &&
        input.status === "CONFIRMED" &&
        order.orderType === "DELIVERY"
      )
    )
      throw new AppError(
        400,
        "Delivery fee can only be set when confirming a delivery order",
      );

    await client.query(
      `UPDATE orders SET status = $2, delivery_fee = COALESCE($3::numeric, delivery_fee), total = total + COALESCE($3::numeric, 0) WHERE id = $1`,
      [orderId, input.status, input.deliveryFee ?? null],
    );
    return { storeId: order.storeId };
  });
}
