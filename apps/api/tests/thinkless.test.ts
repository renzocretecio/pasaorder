import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";
process.env.INFERENCE_URL = "http://127.0.0.1:8001";
process.env.INFERENCE_API_KEY = "test-internal-key-at-least-32-characters";

const { pool } = await import("../src/db.js");
const { analyzeChatConversation, conversationMessages, thinklessAvailable } =
  await import("../src/modules/orders/thinkless.service.js");
const { chatInboxBucket, routeChatDecision, intentDecisionLog } =
  await import("../src/modules/orders/decision-router.js");

test("conversation roles survive the Express-to-FastAPI boundary", () => {
  assert.deepEqual(
    conversationMessages(
      "Customer: Pa-order burger\nStore: Anong size?\nCustomer: Large po",
    ),
    [
      { role: "customer", content: "Pa-order burger" },
      { role: "store", content: "Anong size?" },
      { role: "customer", content: "Large po" },
    ],
  );
});

test("ThinkLess response is validated and maps to the current inbox contract", async () => {
  assert.equal(thinklessAvailable(), true);
  const originalQuery = pool.query;
  const originalFetch = globalThis.fetch;
  let sent: unknown;
  pool.query = (async () => ({
    rows: [{ active: true }],
  })) as unknown as typeof pool.query;
  globalThis.fetch = (async (_url, options) => {
    assert.equal(
      (options?.headers as Record<string, string>)["X-Internal-Key"],
      process.env.INFERENCE_API_KEY,
    );
    sent = JSON.parse(String(options?.body));
    return new Response(
      JSON.stringify({
        bucket: "NEEDS_ATTENTION",
        confidence: 1,
        provider: "rules",
        status: "accepted",
      }),
      { status: 200 },
    );
  }) as typeof fetch;
  try {
    const decision = await analyzeChatConversation(
      "Customer: Dagdag fries",
      "42",
    );
    assert.deepEqual(sent, {
      messages: [{ role: "customer", content: "Dagdag fries" }],
      has_active_order: true,
    });
    assert.equal(decision.model, "thinkless");
    assert.equal(decision.policyVersion, 3);
    assert.equal(decision.provider, "rules");
    assert.equal(decision.bucket, "NEEDS_ATTENTION");
    assert.equal(chatInboxBucket(decision), "NEEDS_ATTENTION");
    assert.equal(routeChatDecision(decision), "REVIEW_UNCLEAR");
    assert.equal(intentDecisionLog("42", decision).threshold, 0.8);
  } finally {
    pool.query = originalQuery;
    globalThis.fetch = originalFetch;
  }
});

test("an uncertain classification remains in Needs attention", async () => {
  const originalQuery = pool.query;
  const originalFetch = globalThis.fetch;
  pool.query = (async () => ({
    rows: [{ active: false }],
  })) as unknown as typeof pool.query;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        bucket: "POSSIBLE_ORDER",
        confidence: 0.4,
        provider: "laya",
        status: "uncertain",
      }),
      { status: 200 },
    )) as typeof fetch;
  try {
    const decision = await analyzeChatConversation("Customer: Yung dati", "42");
    assert.equal(decision.bucket, "NEEDS_ATTENTION");
    assert.equal(chatInboxBucket(decision), "NEEDS_ATTENTION");
  } finally {
    pool.query = originalQuery;
    globalThis.fetch = originalFetch;
  }
});
