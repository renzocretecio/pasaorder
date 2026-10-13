import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";

const { pool } = await import("../src/db.js");
const { listRecentOrders } =
  await import("../src/modules/orders/orders.repository.js");

test("recent orders include past statuses and keep item details", async () => {
  const originalQuery = pool.query;
  const queries: { sql: string; params?: unknown[] }[] = [];
  pool.query = (async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    if (sql.includes("FROM orders o JOIN stores s"))
      return {
        rows: [
          {
            id: "42",
            storeId: "9",
            storeName: "Cafe",
            status: "COMPLETED",
            orderType: "PICKUP",
            paymentMethod: "CASH",
            paymentStatus: "PAID",
            source: "MENU",
            tableNumber: null,
            customerName: "Customer",
            customerPhone: null,
            deliveryAddress: null,
            deliveryFee: null,
            subtotal: "100.00",
            total: "100.00",
            notes: null,
            createdAt: new Date("2026-10-09T04:30:00Z"),
          },
        ],
      };
    if (sql.includes("FROM order_items WHERE order_id"))
      return {
        rows: [
          {
            id: "1",
            orderId: "42",
            productId: "3",
            productName: "Iced coffee",
            optionLabel: "Large",
            specialInstructions: null,
            quantity: 2,
            unitPrice: "50.00",
            subtotal: "100.00",
          },
        ],
      };
    throw new Error(`Unexpected query: ${sql}`);
  }) as typeof pool.query;
  try {
    const orders = await listRecentOrders("7", "9");
    assert.equal(orders.length, 1);
    assert.equal(orders[0].status, "COMPLETED");
    assert.equal(orders[0].items[0].productName, "Iced coffee");
    assert.match(queries[0].sql, /s\.owner_id = \$1 AND o\.store_id = \$2/);
    assert.match(
      queries[0].sql,
      /ORDER BY o\.created_at DESC, o\.id DESC LIMIT 5/,
    );
    assert.deepEqual(queries[0].params, ["7", "9"]);
  } finally {
    pool.query = originalQuery;
  }
});
