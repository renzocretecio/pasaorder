import assert from "node:assert/strict";
import { test } from "node:test";
import type { PoolClient } from "pg";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";
const { pool } = await import("../src/db.js");
const { createManualOrder } =
  await import("../src/modules/orders/orders.repository.js");
const input = {
  idempotencyKey: "123e4567-e89b-42d3-a456-426614174001",
  customerName: "Walk-in",
  orderType: "PICKUP" as const,
  paymentMethod: "CASH" as const,
  items: [
    {
      productId: "3",
      variantId: null,
      quantity: 2,
      expectedUnitPrice: "120.00",
    },
  ],
};

async function withClient(
  query: (sql: string, values?: unknown[]) => unknown,
  run: () => Promise<void>,
) {
  const original = pool.connect;
  pool.connect = (async () =>
    ({
      query: async (sql: string, values?: unknown[]) => query(sql, values),
      release() {},
    }) as unknown as PoolClient) as typeof pool.connect;
  try {
    await run();
  } finally {
    pool.connect = original;
  }
}

test("manual retries lock the key and return the original order without inserting", async () => {
  const queries: string[] = [];
  await withClient(
    (sql) => {
      queries.push(sql);
      if (sql.includes("WHERE o.idempotency_key"))
        return {
          rows: [
            {
              trackingToken: "token",
              storeId: "2",
              ownerId: "1",
              slug: "coffee",
              source: "MANUAL",
            },
          ],
        };
      if (sql.includes("WHERE tracking_token"))
        return { rows: [{ id: "42", storeId: "2" }] };
      return { rows: [] };
    },
    async () => {
      const result = await createManualOrder("1", "2", input);
      assert.equal(result.created, false);
      assert.equal(result.order.id, "42");
      assert.ok(queries[1].includes("pg_advisory_xact_lock"));
      assert.ok(queries[2].includes("WHERE o.idempotency_key"));
      assert.equal(
        queries.some((sql) => sql.startsWith("INSERT")),
        false,
      );
    },
  );
});

test("manual retries cannot retrieve another owner's order", async () => {
  await withClient(
    (sql) => ({
      rows: sql.includes("WHERE o.idempotency_key")
        ? [
            {
              trackingToken: "secret",
              storeId: "2",
              ownerId: "9",
              slug: "coffee",
              source: "MANUAL",
            },
          ]
        : [],
    }),
    async () => {
      await assert.rejects(createManualOrder("1", "2", input), /another order/);
    },
  );
});

test("changed offline prices reject before order insertion", async () => {
  const queries: string[] = [];
  await withClient(
    (sql) => {
      queries.push(sql);
      if (sql.includes('payment_methods AS "paymentMethods"'))
        return {
          rows: [{ id: "2", orderTypes: ["PICKUP"], paymentMethods: ["CASH"] }],
        };
      if (sql.includes("FROM products p JOIN categories"))
        return {
          rows: [
            {
              id: "3",
              name: "Coffee",
              price: "150.00",
              isAvailable: true,
              variantId: null,
              variantPrice: null,
              hasVariants: false,
            },
          ],
        };
      return { rows: [] };
    },
    async () => {
      await assert.rejects(createManualOrder("1", "2", input), /price changed/);
      assert.equal(
        queries.some((sql) => sql.startsWith("INSERT")),
        false,
      );
      assert.ok(queries.includes("ROLLBACK"));
    },
  );
});
