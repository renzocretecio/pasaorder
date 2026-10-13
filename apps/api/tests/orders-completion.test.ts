import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";

const { pool } = await import("../src/db.js");
const { updateOwnerOrder } =
  await import("../src/modules/orders/orders.repository.js");

test("completing an order removes its confirmed chat draft in the same transaction", async () => {
  const originalConnect = pool.connect;
  const queries: { sql: string; params?: unknown[] }[] = [];
  let released = false;
  pool.connect = (async () => ({
    query: async (sql: string, params?: unknown[]) => {
      queries.push({ sql, params });
      if (sql.startsWith("SELECT o.store_id"))
        return {
          rows: [
            {
              storeId: "9",
              status: "READY",
              orderType: "PICKUP",
              deliveryFee: null,
            },
          ],
        };
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  })) as typeof pool.connect;
  try {
    assert.deepEqual(
      await updateOwnerOrder("7", "42", { status: "COMPLETED" }),
      {
        storeId: "9",
      },
    );
    assert.deepEqual(
      queries.map(({ sql }) => sql.split(" ")[0]),
      ["BEGIN", "SELECT", "UPDATE", "DELETE", "COMMIT"],
    );
    assert.match(queries[3].sql, /order_id = \$1 AND status = 'CONFIRMED'/);
    assert.deepEqual(queries[3].params, ["42"]);
    assert.equal(released, true);
  } finally {
    pool.connect = originalConnect;
  }
});

test("an order in progress keeps its linked chat draft", async () => {
  const originalConnect = pool.connect;
  const queries: string[] = [];
  pool.connect = (async () => ({
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.startsWith("SELECT o.store_id"))
        return {
          rows: [
            {
              storeId: "9",
              status: "CONFIRMED",
              orderType: "PICKUP",
              deliveryFee: null,
            },
          ],
        };
      return { rows: [] };
    },
    release: () => {},
  })) as typeof pool.connect;
  try {
    await updateOwnerOrder("7", "42", { status: "PREPARING" });
    assert.equal(
      queries.some((sql) => sql.startsWith("DELETE")),
      false,
    );
  } finally {
    pool.connect = originalConnect;
  }
});

test("a draft cleanup error rolls back the order completion", async () => {
  const originalConnect = pool.connect;
  const queries: string[] = [];
  let released = false;
  pool.connect = (async () => ({
    query: async (sql: string) => {
      queries.push(sql);
      if (sql.startsWith("SELECT o.store_id"))
        return {
          rows: [
            {
              storeId: "9",
              status: "READY",
              orderType: "PICKUP",
              deliveryFee: null,
            },
          ],
        };
      if (sql.startsWith("DELETE")) throw new Error("Database cleanup failed");
      return { rows: [] };
    },
    release: () => {
      released = true;
    },
  })) as typeof pool.connect;
  try {
    await assert.rejects(
      updateOwnerOrder("7", "42", { status: "COMPLETED" }),
      /Database cleanup failed/,
    );
    assert.equal(queries.at(-1), "ROLLBACK");
    assert.equal(released, true);
  } finally {
    pool.connect = originalConnect;
  }
});
