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

test("completing an order updates its status in a transaction", async () => {
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
      ["BEGIN", "SELECT", "UPDATE", "COMMIT"],
    );
    assert.equal(released, true);
  } finally {
    pool.connect = originalConnect;
  }
});
