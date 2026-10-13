import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";

const { pool } = await import("../src/db.js");
const { decodeHistoryCursor, listPastOrders } =
  await import("../src/modules/orders/orders.repository.js");

test("past orders use a stable timestamp and ID cursor and filter unpaid on the server", async () => {
  const originalQuery = pool.query;
  const queries: { sql: string; params?: unknown[] }[] = [];
  const createdAt = new Date("2026-10-09T04:30:00.123Z");
  pool.query = (async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    if (sql.startsWith("SELECT 1 FROM stores"))
      return { rows: [{ "?column?": 1 }] };
    if (sql.includes('AS "totalCount"'))
      return { rows: [{ totalCount: 25, unpaidCount: 22 }] };
    if (sql.includes('AS "cursorTime"'))
      return {
        rows: Array.from({ length: 11 }, (_, index) => ({
          id: String(30 - index),
          storeId: "9",
          storeName: "Cafe",
          status: "COMPLETED",
          orderType: "PICKUP",
          paymentMethod: "CASH",
          paymentStatus: "UNPAID",
          source: "MENU",
          tableNumber: null,
          customerName: "Customer",
          customerPhone: null,
          deliveryAddress: null,
          deliveryFee: null,
          subtotal: "100.00",
          total: "100.00",
          notes: null,
          createdAt,
          cursorTime: "2026-10-09T04:30:00.123456Z",
        })),
      };
    if (sql.includes("FROM order_items WHERE order_id")) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  }) as typeof pool.query;
  try {
    const first = await listPastOrders("7", "9", undefined, "UNPAID");
    assert.equal(first.orders.length, 10);
    assert.equal(first.orders[0].id, "30");
    assert.equal(first.orders.at(-1)?.id, "21");
    assert.equal(first.totalCount, 25);
    assert.equal(first.unpaidCount, 22);
    assert.ok(first.nextCursor);
    assert.deepEqual(decodeHistoryCursor(first.nextCursor), {
      createdAt: "2026-10-09T04:30:00.123456Z",
      id: "21",
    });
    const pageQuery = queries.find(({ sql }) =>
      sql.includes('AS "cursorTime"'),
    )!;
    assert.match(
      pageQuery.sql,
      /ORDER BY o\.created_at DESC, o\.id DESC LIMIT \$5/,
    );
    assert.match(pageQuery.sql, /o\.payment_status = 'UNPAID'/);
    assert.equal(pageQuery.params?.[4], 11);
    await listPastOrders("7", "9", first.nextCursor, "UNPAID");
    const nextQuery = queries.filter(({ sql }) =>
      sql.includes('AS "cursorTime"'),
    )[1];
    assert.equal(nextQuery.params?.[2], "2026-10-09T04:30:00.123456Z");
    assert.equal(nextQuery.params?.[3], "21");
  } finally {
    pool.query = originalQuery;
  }
});

test("invalid history cursors are rejected", () => {
  assert.throws(
    () => decodeHistoryCursor("not-a-cursor"),
    /Invalid past orders cursor/,
  );
});
