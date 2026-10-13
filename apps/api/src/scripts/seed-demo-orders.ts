import { randomUUID } from "node:crypto";
import { pool } from "../db.js";
import { env } from "../config/env.js";

const marker = "[PASAORDER DEMO]";
const slug = process.argv
  .find((arg) => arg.startsWith("--store-slug="))
  ?.split("=")[1];
const replaceExisting = process.argv.includes("--replace");

if (env.NODE_ENV === "production") {
  throw new Error("Demo orders are disabled when NODE_ENV=production.");
}
if (!slug) {
  throw new Error("Pass --store-slug=your-store to choose the target store.");
}

function startOfTodayInManila(now: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return new Date(
    Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) -
      8 * 60 * 60 * 1000,
  );
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const storeResult = await client.query<{
      id: string;
      name: string;
      orderTypes: string[];
      paymentMethods: string[];
    }>(
      `SELECT id, name, order_types AS "orderTypes", payment_methods AS "paymentMethods" FROM stores WHERE slug = $1 AND is_active = true`,
      [slug],
    );
    const store = storeResult.rows[0];
    if (!store) throw new Error(`No active store found for slug "${slug}".`);

    const products = await client.query<{
      id: string;
      name: string;
      variantLabel: string | null;
      price: string;
    }>(
      `SELECT p.id, p.name, v.label AS "variantLabel", COALESCE(v.price, p.price)::text AS price FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN LATERAL (SELECT label, price FROM product_variants WHERE product_id = p.id ORDER BY sort_order, id LIMIT 1) v ON true WHERE c.store_id = $1 AND p.is_available = true ORDER BY c.sort_order, p.sort_order, p.id`,
      [store.id],
    );
    if (!products.rows.length)
      throw new Error(
        "Add at least one available product before seeding orders.",
      );

    const today = startOfTodayInManila(new Date());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const existing = await client.query<{ orders: string; chats: string }>(
      `SELECT (SELECT count(*) FROM orders WHERE store_id = $1 AND notes LIKE $2 AND created_at >= $3 AND created_at < $4)::text AS orders, (SELECT count(*) FROM chat_order_drafts WHERE store_id = $1 AND provider_conversation_id LIKE $5 AND created_at >= $3 AND created_at < $4)::text AS chats`,
      [store.id, `${marker}%`, today, tomorrow, `demo:${slug}:%`],
    );
    const existingOrders = Number(existing.rows[0].orders);
    const existingChats = Number(existing.rows[0].chats);
    if ((existingOrders || existingChats) && !replaceExisting)
      throw new Error(
        `Demo data already exists today for ${slug} (${existingOrders} orders, ${existingChats} chats). Add --replace to replace only today's tagged demo records.`,
      );
    if (replaceExisting) {
      await client.query(
        `DELETE FROM chat_order_drafts WHERE store_id = $1 AND provider_conversation_id LIKE $2 AND created_at >= $3 AND created_at < $4`,
        [store.id, `demo:${slug}:%`, today, tomorrow],
      );
      await client.query(
        `DELETE FROM orders WHERE store_id = $1 AND notes LIKE $2 AND created_at >= $3 AND created_at < $4`,
        [store.id, `${marker}%`, today, tomorrow],
      );
    }

    const statuses = [
      "NEW",
      "NEW",
      "CONFIRMED",
      "CONFIRMED",
      "PREPARING",
      "READY",
      "COMPLETED",
      "COMPLETED",
    ] as const;
    const orderTypes = store.orderTypes.length ? store.orderTypes : ["PICKUP"];
    const paymentMethods = store.paymentMethods.length
      ? store.paymentMethods
      : ["CASH"];
    const nineAM = today.getTime() + 9 * 60 * 60 * 1000;
    const start = Math.min(nineAM, Date.now());
    const span = Date.now() - start;

    for (let index = 0; index < statuses.length; index += 1) {
      const first = products.rows[index % products.rows.length];
      const second = products.rows[(index + 1) % products.rows.length];
      const firstQuantity = (index % 3) + 1;
      const secondQuantity = index % 2 === 0 ? 1 : 0;
      const total = (
        Number(first.price) * firstQuantity +
        Number(second.price) * secondQuantity
      ).toFixed(2);
      const createdAt = new Date(
        start + (span * (index + 1)) / (statuses.length + 1),
      );
      const status = statuses[index];
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO orders (store_id, customer_name, customer_phone, order_type, payment_method, payment_status, source, status, total, notes, tracking_token, idempotency_key, created_at) VALUES ($1, $2, $3, $4, $5, $6, 'MENU', $7, $8, $9, $10, $11, $12) RETURNING id`,
        [
          store.id,
          `Demo Customer ${String(index + 1).padStart(2, "0")}`,
          `091700000${String(index + 1).padStart(2, "0")}`,
          orderTypes[index % orderTypes.length],
          paymentMethods[index % paymentMethods.length],
          status === "COMPLETED" ? "PAID" : "UNPAID",
          status,
          total,
          `${marker} Generated for local testing.`,
          randomUUID(),
          randomUUID(),
          createdAt,
        ],
      );

      for (const [product, quantity] of [
        [first, firstQuantity],
        [second, secondQuantity],
      ] as const) {
        if (!quantity) continue;
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, option_label, quantity, unit_price, subtotal) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            inserted.rows[0].id,
            product.id,
            product.name,
            product.variantLabel,
            quantity,
            product.price,
            (Number(product.price) * quantity).toFixed(2),
          ],
        );
      }
    }

    const demoChats = [
      {
        customerName: "Demo Chat Customer 01",
        bucket: "POSSIBLE_ORDER",
        messages: [
          "Hi! Do you have iced latte?",
          "I'd like to order two for pickup.",
        ],
      },
      {
        customerName: "Demo Chat Customer 02",
        bucket: "POSSIBLE_ORDER",
        messages: [
          "Can I get one of your best sellers?",
          "One chicken rice bowl, please.",
        ],
      },
      {
        customerName: "Demo Chat Customer 03",
        bucket: "NEEDS_ATTENTION",
        messages: [
          "I placed an order a while ago.",
          "Can I add one more drink to it?",
        ],
      },
      {
        customerName: "Demo Chat Customer 04",
        bucket: "NEEDS_ATTENTION",
        messages: [
          "I need to change my pickup time.",
          "Can someone help me with my order?",
        ],
      },
      {
        customerName: "Demo Chat Customer 05",
        bucket: "NORMAL",
        messages: ["What time do you close today?"],
      },
      {
        customerName: "Demo Chat Customer 06",
        bucket: "NORMAL",
        messages: ["Thanks, got it!"],
      },
    ] as const;
    for (let index = 0; index < demoChats.length; index += 1) {
      const chat = demoChats[index];
      const createdAt = new Date(
        start + (span * (index + 1)) / (demoChats.length + 1),
      );
      const messages = chat.messages.map((text, messageIndex) => ({
        id: `demo-${slug}-${index + 1}-${messageIndex + 1}`,
        text,
        createdAt: new Date(
          createdAt.getTime() + messageIndex * 60_000,
        ).toISOString(),
      }));
      const conversationText = chat.messages
        .map((text) => `Customer: ${text}`)
        .join("\n");
      await client.query(
        `INSERT INTO chat_order_drafts (store_id, source, conversation_text, draft_data, decision, provider_conversation_id, chat_messages, created_at, updated_at) VALUES ($1, 'WEB_CHAT', $2, $3::jsonb, $4::jsonb, $5, $6::jsonb, $7, $7)`,
        [
          store.id,
          conversationText,
          JSON.stringify({ customerName: chat.customerName, demoData: true }),
          JSON.stringify({
            model: "thinkless",
            policyVersion: 3,
            provider: "demo-seed",
            bucket: chat.bucket,
            confidence: 0.99,
            analyzedAt: createdAt.toISOString(),
          }),
          `demo:${slug}:${createdAt.toISOString()}:${index + 1}`,
          JSON.stringify(messages),
          createdAt,
        ],
      );
    }
    await client.query("COMMIT");
    console.log(
      `Created 8 demo orders and 6 customer chats for ${store.name} today (Manila time). Chats include 2 possible orders, 2 needing attention, and 2 ordinary conversations.`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
