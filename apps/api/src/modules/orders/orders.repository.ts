import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  OrderAttachment,
  OrderSource,
  OwnerOrder,
  PaymentProof,
  PastOrdersPage,
  StoreOverview,
} from "@pasaorder/types";
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
  scheduledFor?: string;
  notes?: string;
  items: {
    productId: string;
    variantId: string | null;
    quantity: number;
    specialInstructions?: string;
    addOns?: { groupId: string; optionId: string }[];
    productAnswers?: { questionId: string; value: string }[];
    expectedUnitPrice?: string;
  }[];
  formAnswers?: { questionId: string; value: string }[];
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
    `SELECT id, store_id AS "storeId", status, order_type AS "orderType", table_number AS "tableNumber", delivery_fee AS "deliveryFee", scheduled_for AS "scheduledFor", total, tracking_token AS "trackingToken", payment_method AS "paymentMethod", payment_status AS "paymentStatus", payment_instructions AS "paymentInstructions" FROM orders WHERE tracking_token = $1`,
    [trackingToken],
  );
  return order.rows[0];
}

async function createOrder(
  input: OrderInput,
  access?: { ownerId: string; storeId: string; source: OrderSource },
) {
  return transaction(async (client) => {
    // Serialize retries, including concurrent tabs or a response lost in transit.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [input.idempotencyKey],
    );
    const existing = await client.query<{
      trackingToken: string;
      storeId: string;
      ownerId: string;
      slug: string;
      source: OrderSource;
    }>(
      `SELECT o.tracking_token AS "trackingToken", o.store_id AS "storeId", s.owner_id AS "ownerId", s.slug, o.source FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.idempotency_key = $1`,
      [input.idempotencyKey],
    );
    if (existing.rows[0]) {
      const saved = existing.rows[0];
      if (
        access
          ? saved.storeId !== access.storeId ||
            saved.ownerId !== access.ownerId ||
            saved.source !== "MANUAL"
          : saved.slug !== input.storeSlug || saved.source !== "MENU"
      )
        throw new AppError(409, "This request belongs to another order.");
      return {
        order: await readCreatedOrder(client, existing.rows[0].trackingToken),
        created: false,
      };
    }

    const storeResult = await client.query<{
      id: string;
      orderTypes: string[];
      paymentMethods: string[];
      gcashAccountName: string | null;
      gcashNumber: string | null;
      gcashQrUrl: string | null;
    }>(
      `SELECT id, order_types AS "orderTypes", payment_methods AS "paymentMethods", gcash_account_name AS "gcashAccountName", gcash_number AS "gcashNumber", gcash_qr_url AS "gcashQrUrl" FROM stores WHERE ${access ? "id = $1 AND owner_id = $2 AND is_active = true" : "slug = $1 AND is_active = true AND is_published = true"} FOR SHARE`,
      access ? [access.storeId, access.ownerId] : [input.storeSlug],
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

    const formAnswers: { questionId: string; label: string; value: string }[] =
      [];

    const orderItems: {
      productId: string;
      productName: string;
      productType: "PHYSICAL" | "MADE_TO_ORDER" | "SERVICE";
      optionLabel: string | null;
      specialInstructions: string | null;
      quantity: number;
      unitPrice: string;
      subtotal: string;
      addOns: { groupName: string; optionName: string; price: string }[];
      productAnswers: { questionId: string; label: string; value: string }[];
    }[] = [];
    let totalCents = 0;
    for (let itemIndex = 0; itemIndex < input.items.length; itemIndex += 1) {
      const line = input.items[itemIndex];
      const product = await client.query<{
        id: string;
        name: string;
        productType: "PHYSICAL" | "MADE_TO_ORDER" | "SERVICE";
        price: string;
        isAvailable: boolean;
        variantId: string | null;
        variantLabel: string | null;
        variantPrice: string | null;
        hasVariants: boolean;
        addOnGroups: {
          id: string;
          name: string;
          selection: "SINGLE" | "MULTIPLE";
          required: boolean;
          options: { id: string; name: string; price: string }[];
        }[];
      }>(
        `SELECT p.id, p.name, p.product_type AS "productType", p.price, p.add_on_groups AS "addOnGroups", p.is_available AS "isAvailable", v.id AS "variantId", v.label AS "variantLabel", v.price AS "variantPrice", EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id) AS "hasVariants" FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN product_variants v ON v.product_id = p.id AND v.id = $3 WHERE p.id = $1 AND c.store_id = $2`,
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
      const savedProductAnswers: {
        questionId: string;
        label: string;
        value: string;
      }[] = [];
      const unitPrice = item.variantPrice ?? item.price;
      const selected = line.addOns ?? [];
      const selectedIds = new Set<string>();
      const addOns: {
        groupName: string;
        optionName: string;
        price: string;
      }[] = [];
      let addOnCents = 0;
      for (const group of item.addOnGroups ?? []) {
        const groupSelections = selected.filter(
          (choice) => choice.groupId === group.id,
        );
        if (group.required && groupSelections.length === 0)
          throw new AppError(400, `Choose an option for ${group.name}`);
        if (group.selection === "SINGLE" && groupSelections.length > 1)
          throw new AppError(400, `Choose only one option for ${group.name}`);
        for (const choice of groupSelections) {
          const option = group.options.find(
            (entry) => entry.id === choice.optionId,
          );
          if (!option || selectedIds.has(choice.optionId))
            throw new AppError(
              400,
              "A selected add-on is no longer available. Refresh the catalog and try again.",
            );
          selectedIds.add(choice.optionId);
          addOnCents += cents(option.price);
          addOns.push({
            groupName: group.name,
            optionName: option.name,
            price: option.price,
          });
        }
      }
      if (selected.length !== selectedIds.size)
        throw new AppError(
          400,
          "A selected add-on is no longer available. Refresh the catalog and try again.",
        );
      const fullUnitPrice = amount(cents(unitPrice) + addOnCents);
      if (
        access?.source === "MANUAL" &&
        line.expectedUnitPrice !== undefined &&
        cents(line.expectedUnitPrice) !== cents(fullUnitPrice)
      )
        throw new AppError(
          409,
          "A menu price changed while this order was offline. Refresh the catalog and review the order before syncing.",
        );
      const lineCents = cents(fullUnitPrice) * line.quantity;
      totalCents += lineCents;
      orderItems.push({
        productId: item.id,
        productName: item.name,
        productType: item.productType,
        optionLabel: item.variantLabel,
        specialInstructions: line.specialInstructions || null,
        quantity: line.quantity,
        unitPrice: fullUnitPrice,
        subtotal: amount(lineCents),
        addOns,
        productAnswers: savedProductAnswers,
      });
    }

    const trackingToken = randomUUID();
    const created = await client.query<{ id: string }>(
      `INSERT INTO orders (store_id, customer_id, customer_name, customer_phone, delivery_address, order_type, table_number, scheduled_for, payment_method, payment_status, payment_instructions, delivery_fee, total, notes, form_answers, tracking_token, idempotency_key, source) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7::timestamptz, $8, 'UNPAID', $9::jsonb, NULL, $10, $11, $12::jsonb, $13, $14, $15) RETURNING id`,
      [
        store.id,
        input.customerName,
        input.customerPhone || null,
        input.deliveryAddress || null,
        input.orderType,
        input.orderType === "DINE_IN" ? input.tableNumber || null : null,
        input.scheduledFor ?? null,
        input.paymentMethod,
        paymentInstructions ? JSON.stringify(paymentInstructions) : null,
        amount(totalCents),
        input.notes || null,
        JSON.stringify(formAnswers),
        trackingToken,
        input.idempotencyKey,
        access?.source ?? "MENU",
      ],
    );
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_type, option_label, special_instructions, quantity, unit_price, subtotal, add_ons, product_answers) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)`,
        [
          created.rows[0].id,
          item.productId,
          item.productName,
          item.productType,
          item.optionLabel,
          item.specialInstructions,
          item.quantity,
          item.unitPrice,
          item.subtotal,
          JSON.stringify(item.addOns),
          JSON.stringify(item.productAnswers),
        ],
      );
    }
    return {
      order: await readCreatedOrder(client, trackingToken),
      created: true,
    };
  });
}

export function createPublicOrder(input: OrderInput) {
  return createOrder(input);
}

export function createManualOrder(
  ownerId: string,
  storeId: string,
  input: Omit<OrderInput, "storeSlug">,
) {
  return createOrder(
    { ...input, storeSlug: "" },
    {
      ownerId,
      storeId,
      source: "MANUAL",
    },
  );
}

export async function getPublicOrder(trackingToken: string) {
  const result = await pool.query(
    `SELECT o.id, o.store_id AS "storeId", s.name AS "storeName", s.slug AS "storeSlug", s.business_category AS "businessCategory", s.order_workflow AS "orderWorkflow", o.status, o.order_type AS "orderType", o.table_number AS "tableNumber", o.scheduled_for AS "scheduledFor", o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus", o.payment_instructions AS "paymentInstructions", o.form_answers AS "formAnswers", COALESCE((SELECT SUM(oi.subtotal) FROM order_items oi WHERE oi.order_id = o.id), 0)::text AS "itemsSubtotal", o.total, o.delivery_fee AS "deliveryFee", o.created_at AS "createdAt" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.tracking_token = $1`,
    [trackingToken],
  );
  if (!result.rows[0]) throw new AppError(404, "Order not found");
  const items = await pool.query(
    `SELECT product_name AS "productName", product_type AS "productType", option_label AS "optionLabel", add_ons AS "addOns", product_answers AS "productAnswers", quantity, unit_price AS "unitPrice", subtotal FROM order_items WHERE order_id = $1 ORDER BY id`,
    [result.rows[0].id],
  );
  return { ...result.rows[0], items: items.rows };
}

export async function getStoreOverview(
  ownerId: string,
  storeId: string,
  selectedRange?: { from: string; to: string },
): Promise<StoreOverview> {
  const owned = await pool.query(
    "SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2",
    [storeId, ownerId],
  );
  if (!owned.rows[0]) throw new AppError(404, "Store not found");

  const today = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  const currentDate = `${today.year}-${today.month}-${today.day}`;
  const range = selectedRange ?? { from: currentDate, to: currentDate };

  const [summary, trend, products] = await Promise.all([
    pool.query<{
      sales: string;
      ordersCount: number;
      activeOrders: number;
      awaitingConfirmation: number;
    }>(
      `SELECT COALESCE(SUM(total) FILTER (WHERE status = 'COMPLETED'), 0)::text AS sales,
        COUNT(*)::int AS "ordersCount",
        COUNT(*) FILTER (WHERE status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY'))::int AS "activeOrders",
        COUNT(*) FILTER (WHERE status = 'NEW')::int AS "awaitingConfirmation"
      FROM orders WHERE store_id = $1
        AND created_at >= ($2::date::timestamp AT TIME ZONE 'Asia/Manila')
        AND created_at < (($3::date + 1)::timestamp AT TIME ZONE 'Asia/Manila')`,
      [storeId, range.from, range.to],
    ),
    pool.query<{ date: string; sales: string }>(
      `WITH days AS (
        SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date, COALESCE(SUM(o.total), 0)::text AS sales
      FROM days LEFT JOIN orders o ON o.store_id = $1 AND o.status = 'COMPLETED'
        AND (o.created_at AT TIME ZONE 'Asia/Manila')::date = days.day
      GROUP BY days.day ORDER BY days.day`,
      [storeId, range.from, range.to],
    ),
    pool.query<{
      productId: string;
      name: string;
      units: number;
      revenue: string;
    }>(
      `SELECT oi.product_id::text AS "productId", MAX(oi.product_name) AS name,
        SUM(oi.quantity)::int AS units, SUM(oi.subtotal)::text AS revenue
      FROM order_items oi JOIN orders o ON o.id = oi.order_id
      WHERE o.store_id = $1 AND o.status = 'COMPLETED'
        AND (o.created_at AT TIME ZONE 'Asia/Manila')::date >= $2::date
        AND (o.created_at AT TIME ZONE 'Asia/Manila')::date <= $3::date
      GROUP BY oi.product_id ORDER BY units DESC, revenue DESC, name ASC LIMIT 5`,
      [storeId, range.from, range.to],
    ),
  ]);

  return {
    ...summary.rows[0],
    date: currentDate,
    from: range.from,
    to: range.to,
    generatedAt: new Date().toISOString(),
    salesTrend: trend.rows,
    topProducts: products.rows,
  };
}

type OwnerOrderRow = Omit<
  OwnerOrder,
  "createdAt" | "scheduledFor" | "items" | "attachments" | "paymentProof"
> & {
  createdAt: Date;
  scheduledFor: Date | null;
  cursorTime?: string;
};

async function withOrderItems(orders: OwnerOrderRow[]): Promise<OwnerOrder[]> {
  const itemResult = orders.length
    ? await pool.query<OwnerOrder["items"][number]>(
        `SELECT id, order_id AS "orderId", product_id AS "productId", product_name AS "productName", product_type AS "productType", option_label AS "optionLabel", special_instructions AS "specialInstructions", add_ons AS "addOns", product_answers AS "productAnswers", quantity, unit_price AS "unitPrice", subtotal FROM order_items WHERE order_id = ANY($1::bigint[]) ORDER BY id`,
        [orders.map((order) => order.id)],
      )
    : { rows: [] };
  const attachmentResult = orders.length
    ? await pool.query<OrderAttachment>(
        `SELECT id, order_id AS "orderId", order_item_id AS "orderItemId", question_id AS "questionId", question_label AS "questionLabel", file_name AS "fileName", content_type AS "contentType", size_bytes AS "sizeBytes" FROM order_attachments WHERE order_id = ANY($1::bigint[]) ORDER BY created_at, id`,
        [orders.map((order) => order.id)],
      )
    : { rows: [] };
  const proofResult = orders.length
    ? await pool.query<PaymentProof & { orderId: string }>(
        `SELECT id, order_id AS "orderId", file_name AS "fileName", content_type AS "contentType", size_bytes AS "sizeBytes", created_at AS "createdAt" FROM payment_proofs WHERE order_id = ANY($1::bigint[])`,
        [orders.map((order) => order.id)],
      )
    : { rows: [] };
  const itemsByOrder = new Map<string, OwnerOrder["items"]>();
  const attachmentsByOrder = new Map<string, OrderAttachment[]>();
  const proofsByOrder = new Map<string, PaymentProof>();
  for (const item of itemResult.rows) {
    const items = itemsByOrder.get(item.orderId) ?? [];
    items.push(item);
    itemsByOrder.set(item.orderId, items);
  }
  for (const attachment of attachmentResult.rows) {
    const attachments = attachmentsByOrder.get(attachment.orderId) ?? [];
    attachments.push(attachment);
    attachmentsByOrder.set(attachment.orderId, attachments);
  }
  for (const proof of proofResult.rows) {
    const { orderId, createdAt, ...metadata } = proof;
    proofsByOrder.set(orderId, {
      ...metadata,
      contentType: "image/webp",
      createdAt: new Date(createdAt).toISOString(),
    });
  }
  return orders.map(({ cursorTime: _cursorTime, ...order }) => ({
    ...order,
    createdAt: order.createdAt.toISOString(),
    scheduledFor: order.scheduledFor?.toISOString() ?? null,
    items: itemsByOrder.get(order.id) ?? [],
    attachments: attachmentsByOrder.get(order.id) ?? [],
    paymentProof: proofsByOrder.get(order.id) ?? null,
  }));
}

export async function savePublicPaymentProof(input: {
  trackingToken: string;
  id: string;
  objectKey: string;
  fileName: string;
  sizeBytes: number;
}) {
  return transaction(async (client) => {
    const orderResult = await client.query<{
      id: string;
      storeId: string;
      paymentMethod: string;
      paymentStatus: string;
      status: string;
      orderType: string;
      deliveryFee: string | null;
    }>(
      `SELECT id, store_id AS "storeId", payment_method AS "paymentMethod", payment_status AS "paymentStatus", status, order_type AS "orderType", delivery_fee AS "deliveryFee" FROM orders WHERE tracking_token = $1 FOR UPDATE`,
      [input.trackingToken],
    );
    const order = orderResult.rows[0];
    if (!order) throw new AppError(404, "Order not found");
    assertPaymentProofAllowed(order);

    const previous = await client.query<{ objectKey: string }>(
      `SELECT object_key AS "objectKey" FROM payment_proofs WHERE order_id = $1 FOR UPDATE`,
      [order.id],
    );
    await client.query(
      `INSERT INTO payment_proofs (id, order_id, object_key, file_name, content_type, size_bytes) VALUES ($1, $2, $3, $4, 'image/webp', $5) ON CONFLICT (order_id) DO UPDATE SET id = EXCLUDED.id, object_key = EXCLUDED.object_key, file_name = EXCLUDED.file_name, content_type = EXCLUDED.content_type, size_bytes = EXCLUDED.size_bytes, created_at = now()`,
      [input.id, order.id, input.objectKey, input.fileName, input.sizeBytes],
    );
    return {
      storeId: order.storeId,
      previousObjectKey: previous.rows[0]?.objectKey ?? null,
    };
  });
}

function assertPaymentProofAllowed(order: {
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  orderType: string;
  deliveryFee: string | null;
}) {
  if (order.paymentMethod !== "GCASH")
    throw new AppError(400, "Payment proof is only available for GCash orders");
  if (order.paymentStatus === "PAID")
    throw new AppError(409, "This order has already been marked paid");
  if (order.status === "CANCELLED")
    throw new AppError(
      409,
      "Payment proof cannot be added to a cancelled order",
    );
  if (order.status === "NEW")
    throw new AppError(
      409,
      "Wait for the store to confirm your order before sending payment",
    );
  if (order.orderType === "DELIVERY" && order.deliveryFee === null)
    throw new AppError(
      409,
      "Wait for the store to confirm the delivery fee before sending payment",
    );
}

export async function assertPublicPaymentProofAllowed(trackingToken: string) {
  const result = await pool.query<{
    paymentMethod: string;
    paymentStatus: string;
    status: string;
    orderType: string;
    deliveryFee: string | null;
  }>(
    `SELECT payment_method AS "paymentMethod", payment_status AS "paymentStatus", status, order_type AS "orderType", delivery_fee AS "deliveryFee" FROM orders WHERE tracking_token = $1`,
    [trackingToken],
  );
  const order = result.rows[0];
  if (!order) throw new AppError(404, "Order not found");
  assertPaymentProofAllowed(order);
}

export async function getOwnerPaymentProof(ownerId: string, orderId: string) {
  const result = await pool.query<{
    id: string;
    objectKey: string;
    fileName: string;
    sizeBytes: number;
  }>(
    `SELECT p.id, p.object_key AS "objectKey", p.file_name AS "fileName", p.size_bytes AS "sizeBytes" FROM payment_proofs p JOIN orders o ON o.id = p.order_id JOIN stores s ON s.id = o.store_id WHERE p.order_id = $1 AND s.owner_id = $2`,
    [orderId, ownerId],
  );
  if (!result.rows[0]) throw new AppError(404, "Payment proof not found");
  return result.rows[0];
}

export async function getPublicPaymentProof(trackingToken: string) {
  const result = await pool.query<{ createdAt: Date }>(
    `SELECT p.created_at AS "createdAt" FROM payment_proofs p JOIN orders o ON o.id = p.order_id WHERE o.tracking_token = $1`,
    [trackingToken],
  );
  return result.rows[0]
    ? { uploadedAt: result.rows[0].createdAt.toISOString() }
    : null;
}

export async function getOwnerOrderAttachment(
  ownerId: string,
  orderId: string,
  attachmentId: string,
) {
  const result = await pool.query<
    Pick<OrderAttachment, "fileName" | "contentType"> & { objectKey: string }
  >(
    `SELECT a.object_key AS "objectKey", a.file_name AS "fileName", a.content_type AS "contentType" FROM order_attachments a JOIN orders o ON o.id = a.order_id JOIN stores s ON s.id = o.store_id WHERE a.id = $1 AND o.id = $2 AND s.owner_id = $3`,
    [attachmentId, orderId, ownerId],
  );
  const attachment = result.rows[0];
  if (!attachment) throw new AppError(404, "Order attachment not found");
  return attachment;
}

const ownerOrderColumns = `o.id, o.store_id AS "storeId", s.name AS "storeName", o.status, o.order_type AS "orderType", o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus", o.source, o.table_number AS "tableNumber", o.customer_name AS "customerName", o.customer_phone AS "customerPhone", o.delivery_address AS "deliveryAddress", o.delivery_fee AS "deliveryFee", o.scheduled_for AS "scheduledFor", COALESCE(SUM(oi.subtotal), 0)::text AS subtotal, o.total::text AS total, o.notes, o.form_answers AS "formAnswers", o.created_at AS "createdAt"`;

export async function listOwnerOrders(ownerId: string, storeId?: string) {
  const result = await pool.query<OwnerOrderRow>(
    `SELECT ${ownerOrderColumns} FROM orders o JOIN stores s ON s.id = o.store_id LEFT JOIN order_items oi ON oi.order_id = o.id WHERE s.owner_id = $1 AND ($2::bigint IS NULL OR o.store_id = $2) AND o.status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY') GROUP BY o.id, s.name ORDER BY CASE o.status WHEN 'NEW' THEN 0 WHEN 'CONFIRMED' THEN 1 WHEN 'PREPARING' THEN 2 ELSE 3 END, o.created_at ASC LIMIT 300`,
    [ownerId, storeId ?? null],
  );
  return withOrderItems(result.rows);
}

export async function listRecentOrders(ownerId: string, storeId: string) {
  const result = await pool.query<OwnerOrderRow>(
    `SELECT ${ownerOrderColumns} FROM orders o JOIN stores s ON s.id = o.store_id LEFT JOIN order_items oi ON oi.order_id = o.id WHERE s.owner_id = $1 AND o.store_id = $2 GROUP BY o.id, s.name ORDER BY o.created_at DESC, o.id DESC LIMIT 5`,
    [ownerId, storeId],
  );
  return withOrderItems(result.rows);
}

const HISTORY_PAGE_SIZE = 10;

export function decodeHistoryCursor(value: string) {
  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (
      !decoded ||
      typeof decoded !== "object" ||
      typeof decoded.createdAt !== "string" ||
      typeof decoded.id !== "string" ||
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z$/.test(decoded.createdAt) ||
      Number.isNaN(Date.parse(decoded.createdAt)) ||
      !/^[1-9]\d*$/.test(decoded.id) ||
      BigInt(decoded.id) > 9223372036854775807n
    )
      throw new Error("Invalid cursor");
    return { createdAt: decoded.createdAt as string, id: decoded.id as string };
  } catch {
    throw new AppError(400, "Invalid past orders cursor");
  }
}

export async function listPastOrders(
  ownerId: string,
  storeId: string,
  cursor: string | undefined,
  payment: "ALL" | "UNPAID",
): Promise<PastOrdersPage> {
  const owned = await pool.query(
    "SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2",
    [storeId, ownerId],
  );
  if (!owned.rows[0]) throw new AppError(404, "Store not found");
  const after = cursor ? decodeHistoryCursor(cursor) : null;
  const [result, counts] = await Promise.all([
    pool.query<OwnerOrderRow>(
      `SELECT ${ownerOrderColumns}, to_char(o.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "cursorTime" FROM orders o JOIN stores s ON s.id = o.store_id LEFT JOIN order_items oi ON oi.order_id = o.id WHERE o.store_id = $1 AND o.status IN ('COMPLETED', 'CANCELLED') AND ($2::text = 'ALL' OR o.payment_status = 'UNPAID') AND ($3::timestamptz IS NULL OR (o.created_at, o.id) < ($3::timestamptz, $4::bigint)) GROUP BY o.id, s.name ORDER BY o.created_at DESC, o.id DESC LIMIT $5`,
      [
        storeId,
        payment,
        after?.createdAt ?? null,
        after?.id ?? null,
        HISTORY_PAGE_SIZE + 1,
      ],
    ),
    pool.query<{ totalCount: number; unpaidCount: number }>(
      `SELECT COUNT(*)::int AS "totalCount", COUNT(*) FILTER (WHERE payment_status = 'UNPAID')::int AS "unpaidCount" FROM orders WHERE store_id = $1 AND status IN ('COMPLETED', 'CANCELLED')`,
      [storeId],
    ),
  ]);
  const hasMore = result.rows.length > HISTORY_PAGE_SIZE;
  const rows = result.rows.slice(0, HISTORY_PAGE_SIZE);
  const last = rows.at(-1);
  return {
    orders: await withOrderItems(rows),
    nextCursor:
      hasMore && last
        ? Buffer.from(
            JSON.stringify({ createdAt: last.cursorTime, id: last.id }),
          ).toString("base64url")
        : null,
    totalCount: counts.rows[0].totalCount,
    unpaidCount: counts.rows[0].unpaidCount,
  };
}

export async function updateOwnerOrderPayment(
  ownerId: string,
  orderId: string,
  paymentStatus: "UNPAID" | "PAID",
) {
  return transaction(async (client) => {
    const result = await client.query<{
      storeId: string;
      trackingToken: string;
      orderType: string;
      deliveryFee: string | null;
    }>(
      `SELECT o.store_id AS "storeId", o.tracking_token AS "trackingToken", o.order_type AS "orderType", o.delivery_fee AS "deliveryFee" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = $1 AND s.owner_id = $2 FOR UPDATE OF o`,
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
    return { storeId: order.storeId, trackingToken: order.trackingToken };
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
      trackingToken: string;
      status: string;
      orderType: string;
      deliveryFee: string | null;
    }>(
      `SELECT o.store_id AS "storeId", o.tracking_token AS "trackingToken", o.status, o.order_type AS "orderType", o.delivery_fee AS "deliveryFee" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = $1 AND s.owner_id = $2 FOR UPDATE OF o`,
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
    return {
      storeId: order.storeId,
      trackingToken: order.trackingToken,
      previousStatus: order.status,
    };
  });
}
