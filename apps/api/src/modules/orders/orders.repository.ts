import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type {
  ChatDecision,
  ChatOrderDraftData,
  CustomerChat,
  CustomerChatMessage,
  OrderSource,
  OwnerOrder,
  PastOrdersPage,
  StoreOverview,
} from "@pasaorder/types";
import { pool } from "../../db.js";
import { AppError } from "../../middleware/errors.js";
import { transaction } from "../catalog/catalog.repository.js";
import { chatInboxBucket, currentChatDecision } from "./decision-router.js";

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
        SELECT generate_series((now() AT TIME ZONE 'Asia/Manila')::date - 6, (now() AT TIME ZONE 'Asia/Manila')::date, interval '1 day')::date AS day
      )
      SELECT to_char(days.day, 'YYYY-MM-DD') AS date, COALESCE(SUM(o.total), 0)::text AS sales
      FROM days LEFT JOIN orders o ON o.store_id = $1 AND o.status = 'COMPLETED'
        AND (o.created_at AT TIME ZONE 'Asia/Manila')::date = days.day
      GROUP BY days.day ORDER BY days.day`,
      [storeId],
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
        AND (o.created_at AT TIME ZONE 'Asia/Manila')::date >= (now() AT TIME ZONE 'Asia/Manila')::date - 6
      GROUP BY oi.product_id ORDER BY units DESC, revenue DESC, name ASC LIMIT 5`,
      [storeId],
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

type OwnerOrderRow = Omit<OwnerOrder, "createdAt" | "items"> & {
  createdAt: Date;
  cursorTime?: string;
};

async function withOrderItems(orders: OwnerOrderRow[]): Promise<OwnerOrder[]> {
  const itemResult = orders.length
    ? await pool.query<OwnerOrder["items"][number]>(
        `SELECT id, order_id AS "orderId", product_id AS "productId", product_name AS "productName", option_label AS "optionLabel", special_instructions AS "specialInstructions", quantity, unit_price AS "unitPrice", subtotal FROM order_items WHERE order_id = ANY($1::bigint[]) ORDER BY id`,
        [orders.map((order) => order.id)],
      )
    : { rows: [] };
  const itemsByOrder = new Map<string, OwnerOrder["items"]>();
  for (const item of itemResult.rows) {
    const items = itemsByOrder.get(item.orderId) ?? [];
    items.push(item);
    itemsByOrder.set(item.orderId, items);
  }
  return orders.map(({ cursorTime: _cursorTime, ...order }) => ({
    ...order,
    createdAt: order.createdAt.toISOString(),
    items: itemsByOrder.get(order.id) ?? [],
  }));
}

const ownerOrderColumns = `o.id, o.store_id AS "storeId", s.name AS "storeName", o.status, o.order_type AS "orderType", o.payment_method AS "paymentMethod", o.payment_status AS "paymentStatus", o.source, o.table_number AS "tableNumber", o.customer_name AS "customerName", o.customer_phone AS "customerPhone", o.delivery_address AS "deliveryAddress", o.delivery_fee AS "deliveryFee", COALESCE(SUM(oi.subtotal), 0)::text AS subtotal, o.total::text AS total, o.notes, o.created_at AS "createdAt"`;

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
    if (input.status === "COMPLETED") {
      await client.query(
        `DELETE FROM chat_order_drafts WHERE order_id = $1 AND status = 'CONFIRMED'`,
        [orderId],
      );
    }
    return { storeId: order.storeId };
  });
}

type ChatDraftRow = {
  id: string;
  storeId: string;
  source: "MESSENGER" | "INSTAGRAM" | "WEB_CHAT";
  conversationText: string;
  draftData: ChatOrderDraftData;
  decision: unknown;
  status: "DRAFT" | "CONFIRMED";
  orderId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function hashChatToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function startCustomerChat(slug: string, customerName: string) {
  const token = randomBytes(32).toString("base64url");
  const name = customerName.replace(/\s+/g, " ").trim();
  const result = await pool.query<{ id: string }>(
    `INSERT INTO chat_order_drafts (store_id, source, conversation_text, draft_data, access_token_hash) SELECT s.id, 'WEB_CHAT', '', $2::jsonb, $3 FROM stores s WHERE s.slug = $1 AND s.is_active = true AND s.is_published = true RETURNING id`,
    [slug, JSON.stringify({ customerName: name }), hashChatToken(token)],
  );
  if (!result.rows[0]) throw new AppError(404, "Store not found");
  return {
    token,
    chat: { customerName: name, messages: [], status: "DRAFT" as const },
  };
}

export async function getCustomerChat(token: string): Promise<CustomerChat> {
  const result = await pool.query<{
    draftData: ChatOrderDraftData;
    chatMessages: CustomerChatMessage[];
    status: "DRAFT" | "CONFIRMED";
  }>(
    `SELECT draft_data AS "draftData", chat_messages AS "chatMessages", status FROM chat_order_drafts WHERE access_token_hash = $1 AND source = 'WEB_CHAT'`,
    [hashChatToken(token)],
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, "Chat not found");
  return {
    customerName: row.draftData.customerName ?? "Customer",
    messages: row.chatMessages,
    status: row.status,
  };
}

export async function sendCustomerChatMessage(
  token: string,
  messageId: string,
  inputText: string,
) {
  const text = inputText.replace(/\s+/g, " ").trim();
  const result = await pool.query<{
    id: string;
    storeId: string;
    chatMessages: CustomerChatMessage[];
    conversationText: string;
  }>(
    `UPDATE chat_order_drafts d SET chat_messages = d.chat_messages || jsonb_build_array(jsonb_build_object('id', $2::text, 'text', $3::text, 'createdAt', $4::text)), conversation_text = CASE WHEN d.conversation_text = '' THEN 'Customer: ' || $3::text ELSE d.conversation_text || E'\nCustomer: ' || $3::text END, decision = NULL, updated_at = now() FROM stores s WHERE d.store_id = s.id AND d.access_token_hash = $1 AND d.source = 'WEB_CHAT' AND d.status = 'DRAFT' AND s.is_active = true AND s.is_published = true AND jsonb_array_length(d.chat_messages) < 50 AND length(d.conversation_text) + length($3::text) + 11 <= 15000 AND NOT d.chat_messages @> jsonb_build_array(jsonb_build_object('id', $2::text)) RETURNING d.id, d.store_id AS "storeId", d.chat_messages AS "chatMessages", d.conversation_text AS "conversationText"`,
    [hashChatToken(token), messageId, text, new Date().toISOString()],
  );
  if (result.rows[0])
    return {
      messages: result.rows[0].chatMessages,
      updated: {
        ...result.rows[0],
      },
    };
  const existing = await getCustomerChat(token);
  if (existing.messages.some((message) => message.id === messageId))
    return { messages: existing.messages, updated: null };
  if (existing.status !== "DRAFT")
    throw new AppError(409, "This chat is closed.");
  throw new AppError(409, "This chat can’t accept more messages.");
}

export async function savePublicChatDecision(
  draftId: string,
  expectedConversation: string,
  decision: ChatDecision,
) {
  const result = await pool.query(
    `UPDATE chat_order_drafts SET decision = $3::jsonb, updated_at = now() WHERE id = $1 AND source = 'WEB_CHAT' AND status = 'DRAFT' AND conversation_text = $2 RETURNING id`,
    [draftId, expectedConversation, JSON.stringify(decision)],
  );
  return Boolean(result.rows[0]);
}

export async function listChatOrderDrafts(ownerId: string, storeId: string) {
  return (
    await pool.query<
      Omit<ChatDraftRow, "conversationText"> & {
        latestMessage: string | null;
      }
    >(
      `SELECT d.id, d.store_id AS "storeId", d.source, d.draft_data AS "draftData", d.decision, CASE WHEN d.source = 'WEB_CHAT' THEN left(d.chat_messages->-1->>'text', 180) ELSE left(d.conversation_text, 180) END AS "latestMessage", d.status, d.order_id AS "orderId", d.created_at AS "createdAt", d.updated_at AS "updatedAt" FROM chat_order_drafts d JOIN stores s ON s.id = d.store_id WHERE s.owner_id = $1 AND d.store_id = $2 AND d.status = 'DRAFT' AND (d.source <> 'WEB_CHAT' OR d.chat_messages <> '[]'::jsonb) ORDER BY d.updated_at DESC, d.id DESC`,
      [ownerId, storeId],
    )
  ).rows.map((row) => {
    const decision = currentChatDecision(row.decision);
    return {
      ...row,
      decision,
      inboxBucket: chatInboxBucket(decision),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function createChatOrderDraft(
  ownerId: string,
  storeId: string,
  input: { source: "MESSENGER" | "INSTAGRAM"; conversationText: string },
) {
  return transaction(async (client) => {
    const owned = await client.query(
      "SELECT id FROM stores WHERE id = $1 AND owner_id = $2 FOR SHARE",
      [storeId, ownerId],
    );
    if (!owned.rows[0]) throw new AppError(404, "Store not found");
    const result = await client.query<ChatDraftRow>(
      `INSERT INTO chat_order_drafts (store_id, source, conversation_text) VALUES ($1, $2, $3) RETURNING id, store_id AS "storeId", source, conversation_text AS "conversationText", draft_data AS "draftData", decision, status, order_id AS "orderId", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [storeId, input.source, input.conversationText],
    );
    const row = result.rows[0];
    return {
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function getChatOrderDraft(ownerId: string, draftId: string) {
  const result = await pool.query<ChatDraftRow>(
    `SELECT d.id, d.store_id AS "storeId", d.source, d.conversation_text AS "conversationText", d.draft_data AS "draftData", d.decision, d.status, d.order_id AS "orderId", d.created_at AS "createdAt", d.updated_at AS "updatedAt" FROM chat_order_drafts d JOIN stores s ON s.id = d.store_id WHERE s.owner_id = $1 AND d.id = $2`,
    [ownerId, draftId],
  );
  const row = result.rows[0];
  if (!row) throw new AppError(404, "Draft not found");
  return {
    ...row,
    decision: currentChatDecision(row.decision),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function assertChatDraftUnchanged(
  ownerId: string,
  draftId: string,
  conversationText: string,
) {
  const result = await pool.query(
    `SELECT d.id FROM chat_order_drafts d JOIN stores s ON s.id = d.store_id WHERE s.owner_id = $1 AND d.id = $2 AND d.status = 'DRAFT' AND d.conversation_text = $3`,
    [ownerId, draftId, conversationText],
  );
  if (!result.rows[0])
    throw new AppError(
      409,
      "New messages arrived while preparing this draft. Refresh and try again.",
    );
}

export async function updateChatOrderDraft(
  ownerId: string,
  draftId: string,
  input: { conversationText: string; draftData: ChatOrderDraftData },
) {
  const result = await pool.query<{ storeId: string }>(
    `UPDATE chat_order_drafts d SET decision = CASE WHEN d.source <> 'WEB_CHAT' AND d.conversation_text IS DISTINCT FROM $3 THEN NULL ELSE d.decision END, conversation_text = CASE WHEN d.source = 'WEB_CHAT' THEN d.conversation_text ELSE $3 END, draft_data = $4::jsonb, updated_at = now() FROM stores s WHERE d.store_id = s.id AND s.owner_id = $1 AND d.id = $2 AND d.status = 'DRAFT' RETURNING d.store_id AS "storeId"`,
    [ownerId, draftId, input.conversationText, JSON.stringify(input.draftData)],
  );
  if (!result.rows[0])
    throw new AppError(404, "Draft not found or already confirmed");
  return result.rows[0].storeId;
}

export async function saveChatDecision(
  ownerId: string,
  draftId: string,
  expectedConversation: string,
  decision: ChatDecision,
) {
  const result = await pool.query(
    `UPDATE chat_order_drafts d SET decision = $4::jsonb, updated_at = now() FROM stores s WHERE d.store_id = s.id AND s.owner_id = $1 AND d.id = $2 AND d.status = 'DRAFT' AND d.conversation_text = $3 RETURNING d.id`,
    [ownerId, draftId, expectedConversation, JSON.stringify(decision)],
  );
  if (!result.rows[0])
    throw new AppError(
      409,
      "This draft changed while it was being analyzed. Try again.",
    );
}

export async function deleteChatOrderDraft(ownerId: string, draftId: string) {
  const result = await pool.query<{ storeId: string }>(
    `DELETE FROM chat_order_drafts d USING stores s WHERE d.store_id = s.id AND s.owner_id = $1 AND d.id = $2 AND d.status = 'DRAFT' RETURNING d.store_id AS "storeId"`,
    [ownerId, draftId],
  );
  if (!result.rows[0])
    throw new AppError(404, "Draft not found or already confirmed");
  return result.rows[0].storeId;
}

export async function confirmChatOrderDraft(
  ownerId: string,
  draftId: string,
  input: {
    expectedConversationText?: string;
    customerName: string;
    customerPhone?: string;
    orderType: "DINE_IN" | "PICKUP" | "DELIVERY";
    tableNumber?: string;
    deliveryAddress?: string;
    paymentMethod: "CASH" | "GCASH";
    notes?: string;
    items: NonNullable<ChatOrderDraftData["items"]>;
  },
) {
  return transaction(async (client) => {
    const draftResult = await client.query<{
      id: string;
      storeId: string;
      source: "MESSENGER" | "INSTAGRAM" | "WEB_CHAT";
      conversationText: string;
      orderTypes: string[];
      paymentMethods: string[];
      gcashAccountName: string | null;
      gcashNumber: string | null;
      gcashQrUrl: string | null;
    }>(
      `SELECT d.id, d.store_id AS "storeId", d.source, d.conversation_text AS "conversationText", s.order_types AS "orderTypes", s.payment_methods AS "paymentMethods", s.gcash_account_name AS "gcashAccountName", s.gcash_number AS "gcashNumber", s.gcash_qr_url AS "gcashQrUrl" FROM chat_order_drafts d JOIN stores s ON s.id = d.store_id WHERE s.owner_id = $1 AND d.id = $2 AND d.status = 'DRAFT' FOR UPDATE OF d`,
      [ownerId, draftId],
    );
    const draft = draftResult.rows[0];
    if (!draft) throw new AppError(404, "Draft not found or already confirmed");
    if (
      draft.source === "WEB_CHAT" &&
      input.expectedConversationText !== draft.conversationText
    )
      throw new AppError(
        409,
        "New customer messages arrived. Refresh the messages before confirming.",
      );
    if (!draft.orderTypes.includes(input.orderType))
      throw new AppError(400, "This order type is not available at this store");
    if (!draft.paymentMethods.includes(input.paymentMethod))
      throw new AppError(
        400,
        "This payment method is not available at this store",
      );
    const paymentInstructions =
      input.paymentMethod === "GCASH"
        ? {
            gcashAccountName: draft.gcashAccountName!,
            gcashNumber: draft.gcashNumber!,
            gcashQrUrl: draft.gcashQrUrl,
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
        `SELECT p.id, p.name, p.price, p.is_available AS "isAvailable", v.id AS "variantId", v.label AS "variantLabel", v.price AS "variantPrice", EXISTS (SELECT 1 FROM product_variants pv WHERE pv.product_id = p.id) AS "hasVariants" FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN product_variants v ON v.product_id = p.id AND v.id = $3 WHERE p.id = $1 AND c.store_id = $2 FOR SHARE OF p`,
        [line.productId, draft.storeId, line.variantId],
      );
      const item = product.rows[0];
      if (!item || !item.isAvailable)
        throw new AppError(
          400,
          "A selected item is unavailable. Update the draft and try again.",
        );
      if (
        (item.variantId ?? null) !== line.variantId ||
        (item.hasVariants && !line.variantId)
      )
        throw new AppError(
          400,
          "A selected option is unavailable. Update the draft and try again.",
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
    const idempotencyKey = randomUUID();
    const created = await client.query<{ id: string }>(
      `INSERT INTO orders (store_id, customer_id, customer_name, customer_phone, delivery_address, order_type, table_number, payment_method, payment_status, source, payment_instructions, delivery_fee, total, notes, tracking_token, idempotency_key) VALUES ($1, NULL, $2, $3, $4, $5, $6, $7, 'UNPAID', $8, $9::jsonb, NULL, $10, $11, $12, $13) RETURNING id`,
      [
        draft.storeId,
        input.customerName,
        input.customerPhone || null,
        input.deliveryAddress || null,
        input.orderType,
        input.orderType === "DINE_IN" ? input.tableNumber || null : null,
        input.paymentMethod,
        draft.source,
        paymentInstructions ? JSON.stringify(paymentInstructions) : null,
        amount(totalCents),
        input.notes || null,
        trackingToken,
        idempotencyKey,
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
    await client.query(
      `UPDATE chat_order_drafts SET status = 'CONFIRMED', order_id = $2, conversation_text = '', chat_messages = '[]'::jsonb, decision = NULL, updated_at = now() WHERE id = $1`,
      [draftId, created.rows[0].id],
    );
    return { storeId: draft.storeId, orderId: created.rows[0].id };
  });
}
