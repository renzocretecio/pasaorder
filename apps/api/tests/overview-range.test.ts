import assert from "node:assert/strict";
import { test } from "node:test";
import { overviewDateRangeSchema } from "@pasaorder/validation";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";

const { pool } = await import("../src/db.js");
const { getStoreOverview } =
  await import("../src/modules/orders/orders.repository.js");

test("overview date range rejects invalid dates and reversed bounds", () => {
  assert.equal(
    overviewDateRangeSchema.safeParse({ from: "2026-02-30", to: "2026-03-01" })
      .success,
    false,
  );
  assert.equal(
    overviewDateRangeSchema.safeParse({ from: "2026-10-09", to: "2026-10-08" })
      .success,
    false,
  );
  assert.equal(
    overviewDateRangeSchema.safeParse({ from: "2026-10-01", to: "2026-10-09" })
      .success,
    true,
  );
});

test("overview KPI query uses inclusive Philippine calendar dates", async () => {
  const originalQuery = pool.query;
  const queries: { sql: string; params?: unknown[] }[] = [];
  pool.query = (async (sql: string, params?: unknown[]) => {
    queries.push({ sql, params });
    if (sql.startsWith("SELECT 1 FROM stores"))
      return { rows: [{ "?column?": 1 }] };
    if (sql.includes('AS "ordersCount"'))
      return {
        rows: [
          {
            sales: "250.00",
            ordersCount: 3,
            activeOrders: 1,
            awaitingConfirmation: 1,
          },
        ],
      };
    if (sql.includes("WITH days")) return { rows: [] };
    if (sql.includes("FROM order_items oi JOIN orders o")) return { rows: [] };
    throw new Error(`Unexpected query: ${sql}`);
  }) as typeof pool.query;
  try {
    const overview = await getStoreOverview("7", "9", {
      from: "2026-10-01",
      to: "2026-10-09",
    });
    assert.equal(overview.from, "2026-10-01");
    assert.equal(overview.to, "2026-10-09");
    assert.equal(overview.sales, "250.00");
    assert.equal(overview.ordersCount, 3);
    const summary = queries.find(({ sql }) =>
      sql.includes('AS "ordersCount"'),
    )!;
    assert.deepEqual(summary.params, ["9", "2026-10-01", "2026-10-09"]);
    assert.match(
      summary.sql,
      /created_at >= \(\$2::date::timestamp AT TIME ZONE 'Asia\/Manila'\)/,
    );
    assert.match(
      summary.sql,
      /created_at < \(\(\$3::date \+ 1\)::timestamp AT TIME ZONE 'Asia\/Manila'\)/,
    );
  } finally {
    pool.query = originalQuery;
  }
});
