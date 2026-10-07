import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import type { Catalog } from "@pasaorder/types";
import {
  setupStoreSchema,
  catalogStoreSettingsSchema,
  createOrderSchema,
  createProductSchema,
  catalogItemSchema,
  imageUrlSchema,
  idSchema,
  registerSchema,
  createChatOrderDraftSchema,
  confirmChatOrderDraftSchema,
} from "@pasaorder/validation";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";
delete process.env.CLOUDFLARE_AI_ACCOUNT_ID;
delete process.env.CLOUDFLARE_AI_API_TOKEN;
delete process.env.GEMINI_API_KEY;
const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/db.js");
const { signToken } = await import("../src/middleware/auth.js");
const { prepareImage } =
  await import("../src/modules/images/images.service.js");
const { parseClefResponse } =
  await import("../src/modules/orders/clef.service.js");
const {
  canExtractOrderCandidate,
  chatInboxBucket,
  intentDecisionLog,
  routeChatDecision,
} = await import("../src/modules/orders/decision-router.js");
const { listChatOrderDrafts, savePublicChatDecision } =
  await import("../src/modules/orders/orders.repository.js");
const { inquiryContext } =
  await import("../src/modules/orders/inquiry-context.js");
const { parseGeminiResponse, reviewExtraction } =
  await import("../src/modules/orders/gemini.service.js");
const originalQuery = (async (sql: string, params: unknown[]) => {
  if (sql.startsWith("SELECT token_version"))
    return { rows: [{ tokenVersion: 0 }] };
  throw new Error(`Unexpected database query: ${sql}`);
}) as typeof pool.query;
pool.query = originalQuery;
let server: Server;
let base: string;
before(async () => {
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api`;
});
after(async () => {
  pool.query = originalQuery;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
});
const headers = () => ({
  authorization: `Bearer ${signToken("1")}`,
  "content-type": "application/json",
});

test("health and unknown routes have JSON responses", async () => {
  assert.equal((await fetch(`${base}/health`)).status, 200);
  const missing = await fetch(`${base}/missing`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { message: "Route not found" });
  for (const route of ["businesses", "stores"])
    assert.equal((await fetch(`${base}/${route}`)).status, 404);
});
test("management routes and current user reject unauthenticated callers", async () => {
  for (const route of ["catalog/stores", "auth/me"]) {
    assert.equal((await fetch(`${base}/${route}`)).status, 401);
  }
  for (const route of ["catalog/setup"]) {
    assert.equal(
      (
        await fetch(`${base}/${route}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        })
      ).status,
      401,
    );
  }
});
test("chat order draft routes require an authenticated owner", async () => {
  const routes: [string, string][] = [
    ["GET", "/orders/stores/1/chat-drafts"],
    ["POST", "/orders/stores/1/chat-drafts"],
    ["GET", "/orders/chat-drafts/1"],
    ["PATCH", "/orders/chat-drafts/1"],
    ["DELETE", "/orders/chat-drafts/1"],
    ["POST", "/orders/chat-drafts/1/prepare"],
    ["POST", "/orders/chat-drafts/1/confirm"],
  ];
  for (const [method, route] of routes) {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: { "content-type": "application/json" },
      body: ["POST", "PATCH"].includes(method) ? "{}" : undefined,
    });
    assert.equal(response.status, 401, `${method} ${route}`);
  }
});
test("Gemini order extraction matches only exact available catalog items", () => {
  const extracted = parseGeminiResponse({
    steps: [
      {
        type: "model_output",
        content: [
          {
            type: "text",
            text: JSON.stringify({
              customerName: null,
              customerPhone: null,
              orderType: "PICKUP",
              tableNumber: null,
              deliveryAddress: null,
              paymentMethod: "UNSPECIFIED",
              requestedTime: "7:00 PM",
              notes: null,
              items: [
                {
                  name: "Cheeseburger",
                  option: null,
                  quantity: 2,
                  confirmed: true,
                  specialInstructions: null,
                },
                {
                  name: "Fries",
                  option: "XL",
                  quantity: 1,
                  confirmed: true,
                  specialInstructions: null,
                },
                {
                  name: "Coke",
                  option: null,
                  quantity: 1,
                  confirmed: false,
                  specialInstructions: null,
                },
                {
                  name: "Chicken Burger",
                  option: null,
                  quantity: 1,
                  confirmed: true,
                  specialInstructions: null,
                },
              ],
            }),
          },
        ],
      },
    ],
  });
  const catalog = {
    store: { orderTypes: ["PICKUP"], paymentMethods: ["CASH"] },
    categories: [
      {
        items: [
          { id: "11", name: "Cheeseburger", isAvailable: true, variants: [] },
          {
            id: "12",
            name: "Fries",
            isAvailable: true,
            variants: [
              { id: "21", label: "Small" },
              { id: "22", label: "Large" },
            ],
          },
          { id: "13", name: "Coke", isAvailable: true, variants: [] },
          {
            id: "14",
            name: "Chicken Burger",
            isAvailable: false,
            variants: [],
          },
        ],
      },
    ],
  } as unknown as Catalog;
  const review = reviewExtraction(
    extracted,
    catalog,
    { customerName: "Alex" },
    "Customer: order please",
    null,
  );
  assert.equal(review.suggested.customerName, "Alex");
  assert.deepEqual(
    review.suggested.items?.map((item) => [item.productId, item.quantity]),
    [["11", 2]],
  );
  assert.equal(review.unmatchedItems[0].name, "Fries");
  assert.equal(review.unmatchedItems[1].name, "Coke");
  assert.match(review.unmatchedItems[1].reason, /Not clearly ordered/);
  assert.equal(review.unmatchedItems[2].name, "Chicken Burger");
  assert.equal(review.needsAttention, true);
  assert.equal(review.suggested.notes, "Requested time: 7:00 PM");
  assert.ok(
    review.questions.some((question) => question.includes("payment method")),
  );
  assert.ok(
    review.questions.every((question) => !question.includes("mobile number")),
  );
  assert.throws(() =>
    parseGeminiResponse({
      steps: [
        {
          type: "model_output",
          content: [{ type: "text", text: '{"items":[]}' }],
        },
      ],
    }),
  );
});
test("Clef-flash response is normalized and invalid choices are rejected", () => {
  const probabilities = {
    CREATE_ORDER: 0.66,
    MODIFY_ORDER: 0.05,
    CANCEL_ORDER: 0.02,
    ORDER_STATUS: 0.02,
    PRODUCT_INQUIRY: 0.12,
    STORE_INQUIRY: 0.04,
    PAYMENT_INQUIRY: 0.03,
    GREETING: 0.03,
    OTHER: 0.03,
  };
  const result = parseClefResponse({
    success: true,
    result: {
      answers: {
        intent: { choice: "CREATE_ORDER", confidence: 0.66, probabilities },
        fulfillment: { choice: "pickup", confidence: 0.86 },
        payment: { choice: "unspecified", confidence: 0.75 },
        needs_clarification: { type: "noul", noul: 0.62 },
        requires_llm: { type: "noul", noul: 0.94 },
        requires_human: { type: "noul", noul: 0.2 },
      },
    },
  });
  assert.equal(result.model, "clef-flash");
  assert.equal(result.intent.value, "CREATE_ORDER");
  assert.equal(result.intent.probabilities?.PRODUCT_INQUIRY, 0.12);
  assert.equal(result.fulfillment.value, "pickup");
  assert.equal(result.needsClarificationProbability, 0.62);
  assert.equal(result.requiresLLMProbability, 0.94);
  assert.equal(routeChatDecision(result), "EXTRACT_ORDER");
  assert.equal(canExtractOrderCandidate(result), true);
  assert.equal(routeChatDecision(null), "EXTRACT_ORDER");
  const nonOrder = {
    ...result,
    intent: {
      value: "PRODUCT_INQUIRY" as const,
      confidence: 0.9,
      probabilities: {
        ...probabilities,
        CREATE_ORDER: 0.04,
        PRODUCT_INQUIRY: 0.9,
      },
    },
  };
  assert.equal(routeChatDecision(nonOrder), "REVIEW_PRODUCT");
  assert.equal(chatInboxBucket(result), "POSSIBLE_ORDER");
  assert.equal(
    chatInboxBucket({
      ...result,
      intent: {
        value: "CREATE_ORDER",
        confidence: 0.54,
        probabilities: { CREATE_ORDER: 0.54, PRODUCT_INQUIRY: 0.07 },
      },
      needsClarificationProbability: 0.07,
      requiresHumanProbability: 0.03,
    }),
    "POSSIBLE_ORDER",
  );
  assert.equal(chatInboxBucket(nonOrder), "NEEDS_ATTENTION");
  assert.equal(canExtractOrderCandidate(nonOrder), false);
  assert.equal(chatInboxBucket(null), "NEEDS_ATTENTION");
  assert.equal(routeChatDecision(nonOrder, true), "EXTRACT_ORDER");
  assert.deepEqual(intentDecisionLog("42", nonOrder), {
    event: "chat_intent_routed",
    draftId: "42",
    model: "clef-flash",
    intent: "PRODUCT_INQUIRY",
    confidence: 0.9,
    threshold: 0.65,
    runnerUp: 0.05,
    margin: 0.85,
    marginThreshold: 0.2,
    route: "REVIEW_PRODUCT",
    needsClarification: false,
    requiresLLM: true,
    requiresHuman: false,
  });
  assert.equal(
    routeChatDecision({
      ...nonOrder,
      intent: {
        ...nonOrder.intent,
        confidence: 0.46,
        probabilities: {
          ...nonOrder.intent.probabilities,
          PRODUCT_INQUIRY: 0.46,
          CREATE_ORDER: 0.42,
        },
      },
    }),
    "REVIEW_UNCLEAR",
  );
  const partialOrderDecision = {
    ...result,
    intent: {
      value: "CREATE_ORDER" as const,
      confidence: 0.45,
      probabilities: { CREATE_ORDER: 0.45, PRODUCT_INQUIRY: 0.1 },
    },
  };
  assert.equal(routeChatDecision(partialOrderDecision), "REVIEW_UNCLEAR");
  assert.equal(chatInboxBucket(partialOrderDecision), "NEEDS_ATTENTION");
  assert.equal(canExtractOrderCandidate(partialOrderDecision), true);
  assert.equal(
    canExtractOrderCandidate({
      ...partialOrderDecision,
      intent: {
        ...partialOrderDecision.intent,
        probabilities: { CREATE_ORDER: 0.45, PRODUCT_INQUIRY: 0.42 },
      },
    }),
    true,
  );
  assert.throws(() =>
    parseClefResponse({ success: false, result: { answers: {} } }),
  );
  assert.throws(() =>
    parseClefResponse({
      answers: {
        intent: { choice: "approved", confidence: 0.99 },
        fulfillment: { choice: "pickup", confidence: 0.86 },
        payment: { choice: "cash", confidence: 0.9 },
        needs_clarification: { type: "noul", noul: 0.2 },
        requires_llm: { type: "noul", noul: 0.2 },
        requires_human: { type: "noul", noul: 0.2 },
      },
    }),
  );
});
test("nine intents route conservatively and never mutate an order", () => {
  const base = {
    model: "clef-flash" as const,
    fulfillment: { value: "unspecified" as const, confidence: 0.9 },
    payment: { value: "unspecified" as const, confidence: 0.9 },
    needsClarificationProbability: 0.2,
    requiresHumanProbability: 0.2,
    analyzedAt: new Date().toISOString(),
  };
  const cases = [
    ["CREATE_ORDER", "EXTRACT_ORDER"],
    ["MODIFY_ORDER", "REVIEW_MODIFICATION"],
    ["CANCEL_ORDER", "REVIEW_CANCELLATION"],
    ["ORDER_STATUS", "REVIEW_STATUS"],
    ["PRODUCT_INQUIRY", "REVIEW_PRODUCT"],
    ["STORE_INQUIRY", "REVIEW_STORE"],
    ["PAYMENT_INQUIRY", "REVIEW_PAYMENT"],
    ["GREETING", "REVIEW_GREETING"],
    ["OTHER", "REVIEW_OTHER"],
  ] as const;
  for (const [value, expected] of cases) {
    const decision = {
      ...base,
      intent: { value, confidence: 0.95 },
    };
    assert.equal(routeChatDecision(decision), expected, value);
    assert.equal(
      chatInboxBucket(decision),
      value === "CREATE_ORDER"
        ? "POSSIBLE_ORDER"
        : value === "GREETING" || value === "OTHER"
          ? "NORMAL"
          : "NEEDS_ATTENTION",
    );
  }
  assert.equal(
    chatInboxBucket({
      ...base,
      intent: { value: "CREATE_ORDER", confidence: 0.95 },
      needsClarificationProbability: 0.9,
    }),
    "NEEDS_ATTENTION",
  );
  assert.equal(
    chatInboxBucket({
      ...base,
      intent: { value: "OTHER", confidence: 0.95 },
      requiresHumanProbability: 0.9,
    }),
    "NEEDS_ATTENTION",
  );
  assert.equal(
    chatInboxBucket({
      ...base,
      intent: { value: "GREETING", confidence: 0.95 },
      needsClarificationProbability: 0.9,
    }),
    "NORMAL",
  );
  assert.equal(
    routeChatDecision({
      ...base,
      intent: { value: "CANCEL_ORDER", confidence: 0.89 },
    }),
    "REVIEW_CANCELLATION",
  );
  assert.equal(
    routeChatDecision({
      ...base,
      intent: {
        value: "CANCEL_ORDER",
        confidence: 0.89,
        probabilities: { CANCEL_ORDER: 0.89, OTHER: 0.11 },
      },
    }),
    "REVIEW_UNCLEAR",
  );
  assert.equal(
    routeChatDecision({
      ...base,
      intent: { value: "order_request", confidence: 0.95 },
    }),
    "EXTRACT_ORDER",
  );
});
test("inquiry context uses configured catalog facts without guessing products", () => {
  const catalog = {
    store: {
      address: "12 Market St",
      contactPhone: "09171234567",
      operatingHours: null,
      orderTypes: ["PICKUP", "DELIVERY"],
      paymentMethods: ["CASH", "GCASH"],
      gcashAccountName: "Store Owner",
      gcashNumber: "09179990000",
    },
    categories: [
      {
        items: [
          {
            name: "Cheeseburger",
            price: "149.00",
            isAvailable: true,
            variants: [],
          },
          {
            name: "Fries",
            price: "80.00",
            isAvailable: false,
            variants: [],
          },
        ],
      },
    ],
  } as unknown as Catalog;
  const product = inquiryContext(
    "REVIEW_PRODUCT",
    catalog,
    "Customer: Magkano ang cheeseburger?",
  );
  assert.deepEqual(product?.facts, ["Cheeseburger — Available · ₱149.00"]);
  assert.match(
    inquiryContext("REVIEW_PRODUCT", catalog, "Customer: May burger?")!
      .facts[0],
    /No exact product name/,
  );
  assert.ok(
    inquiryContext("REVIEW_STORE", catalog, "Customer: Saan kayo?")!.facts.some(
      (fact) => fact.includes("12 Market St"),
    ),
  );
  assert.ok(
    inquiryContext("REVIEW_PAYMENT", catalog, "Customer: GCash?")!.facts.some(
      (fact) => fact.includes("09179990000"),
    ),
  );
  assert.equal(inquiryContext("REVIEW_CANCELLATION", catalog, "Cancel"), null);
});
test("stale Clef results cannot replace the current conversation decision", async () => {
  const previousQuery = pool.query;
  const decision = parseClefResponse({
    answers: {
      intent: {
        choice: "CREATE_ORDER",
        confidence: 0.91,
        probabilities: {
          CREATE_ORDER: 0.91,
          MODIFY_ORDER: 0.01,
          CANCEL_ORDER: 0.01,
          ORDER_STATUS: 0.01,
          PRODUCT_INQUIRY: 0.02,
          STORE_INQUIRY: 0.01,
          PAYMENT_INQUIRY: 0.01,
          GREETING: 0.01,
          OTHER: 0.01,
        },
      },
      fulfillment: { choice: "unspecified", confidence: 0.9 },
      payment: { choice: "unspecified", confidence: 0.9 },
      needs_clarification: { type: "noul", noul: 0.8 },
      requires_llm: { type: "noul", noul: 0.9 },
      requires_human: { type: "noul", noul: 0.3 },
    },
  });
  pool.query = (async (sql: string, params: unknown[]) => {
    assert.equal(params[0], "42");
    assert.match(sql, /conversation_text = \$2/);
    assert.equal(params[1], "Customer: Hello");
    return { rows: [] }; // The transcript changed while Clef was running.
  }) as typeof pool.query;
  try {
    assert.equal(
      await savePublicChatDecision("42", "Customer: Hello", decision),
      false,
    );
  } finally {
    pool.query = previousQuery;
  }
});
test("the inbox groups chats by their latest decision", async () => {
  const previousQuery = pool.query;
  const decision = {
    model: "clef-flash" as const,
    intent: { value: "CREATE_ORDER" as const, confidence: 0.95 },
    fulfillment: { value: "unspecified" as const, confidence: 0.8 },
    payment: { value: "unspecified" as const, confidence: 0.8 },
    needsClarificationProbability: 0.2,
    requiresHumanProbability: 0.2,
    analyzedAt: new Date().toISOString(),
  };
  pool.query = (async (sql: string, params: unknown[]) => {
    assert.match(sql, /chat_messages->-1->>'text'/);
    assert.doesNotMatch(sql, /initial_decision/);
    assert.deepEqual(params, ["7", "9"]);
    const row = {
      storeId: "9",
      source: "WEB_CHAT",
      draftData: {},
      latestMessage: "Pa-order po",
      status: "DRAFT",
      orderId: null,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
    };
    return {
      rows: [
        { ...row, id: "1", decision },
        {
          ...row,
          id: "2",
          latestMessage: "Cancel ko na",
          decision: {
            ...decision,
            intent: { value: "CANCEL_ORDER", confidence: 0.95 },
          },
        },
      ],
    };
  }) as typeof pool.query;
  try {
    const drafts = await listChatOrderDrafts("7", "9");
    assert.deepEqual(
      drafts.map(({ inboxBucket, latestMessage }) => [
        inboxBucket,
        latestMessage,
      ]),
      [
        ["POSSIBLE_ORDER", "Pa-order po"],
        ["NEEDS_ATTENTION", "Cancel ko na"],
      ],
    );
  } finally {
    pool.query = previousQuery;
  }
});
test("chat drafts validate pasted text and require reviewable order items", () => {
  assert.equal(
    createChatOrderDraftSchema.safeParse({
      source: "MESSENGER",
      conversationText: "Customer: I would like to order",
    }).success,
    true,
  );
  assert.equal(
    createChatOrderDraftSchema.safeParse({
      source: "WHATSAPP",
      conversationText: "Hello, I want to place an order",
    }).success,
    false,
  );
  assert.equal(
    confirmChatOrderDraftSchema.safeParse({
      customerName: "Alex Customer",
      customerPhone: "09171234567",
      orderType: "PICKUP",
      paymentMethod: "CASH",
      items: [],
    }).success,
    false,
  );
  assert.equal(
    confirmChatOrderDraftSchema.safeParse({
      customerName: "Alex Customer",
      orderType: "PICKUP",
      paymentMethod: "CASH",
      items: [{ productId: "1", variantId: null, quantity: 1 }],
    }).success,
    true,
  );
});
test("public customer chat starts with a private token and saves messages", async () => {
  const previousQuery = pool.query;
  let storedHash = "";
  let storedName = "";
  let storedMessages: { id: string; text: string; createdAt: string }[] = [];
  pool.query = (async (sql: string, params: unknown[]) => {
    if (sql.startsWith("INSERT INTO chat_order_drafts")) {
      storedName = (JSON.parse(params[1] as string) as { customerName: string })
        .customerName;
      storedHash = params[2] as string;
      return { rows: [{ id: "42" }] };
    }
    if (sql.startsWith("UPDATE chat_order_drafts d SET chat_messages")) {
      assert.equal(params[0], storedHash);
      storedMessages = [
        ...storedMessages,
        {
          id: params[1] as string,
          text: params[2] as string,
          createdAt: params[3] as string,
        },
      ];
      return {
        rows: [
          {
            id: "42",
            chatMessages: storedMessages,
            conversationText: `Customer: ${storedMessages.map((message) => message.text).join("\nCustomer: ")}`,
          },
        ],
      };
    }
    if (sql.startsWith("SELECT draft_data AS")) {
      assert.equal(params[0], storedHash);
      return {
        rows: [
          {
            draftData: { customerName: storedName },
            chatMessages: storedMessages,
            status: "DRAFT",
          },
        ],
      };
    }
    throw new Error(`Unexpected database query: ${sql}`);
  }) as typeof pool.query;
  try {
    const invalid = await fetch(`${base}/public/chats/stores/coffee-shop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName: "A" }),
    });
    assert.equal(invalid.status, 400);
    const started = await fetch(`${base}/public/chats/stores/coffee-shop`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customerName: "Alex Customer" }),
    });
    assert.equal(started.status, 201);
    const { token, chat } = (await started.json()) as {
      token: string;
      chat: { customerName: string };
    };
    assert.equal(chat.customerName, "Alex Customer");
    assert.equal(storedHash, createHash("sha256").update(token).digest("hex"));
    assert.equal((await fetch(`${base}/public/chats/invalid`)).status, 400);
    const messageId = randomUUID();
    const sent = await fetch(`${base}/public/chats/${token}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId, text: "Two iced coffees, please" }),
    });
    assert.equal(sent.status, 200);
    assert.equal(
      (await sent.json()).messages[0].text,
      "Two iced coffees, please",
    );
    const resumed = await fetch(`${base}/public/chats/${token}`);
    assert.equal(resumed.status, 200);
    assert.equal((await resumed.json()).chat.messages[0].id, messageId);
  } finally {
    pool.query = previousQuery;
  }
});
test("tokens for another audience or signed with another key are rejected", async () => {
  for (const token of [
    jwt.sign({ sub: "1" }, "wrong-secret"),
    jwt.sign(
      { sub: "1", aud: "other", iss: "pasaorder" },
      process.env.JWT_SECRET!,
    ),
  ]) {
    assert.equal(
      (
        await fetch(`${base}/catalog/stores`, {
          headers: { authorization: `Bearer ${token}` },
        })
      ).status,
      401,
    );
  }
});
test("owner ID cannot be injected through the store body", async () => {
  const response = await fetch(`${base}/catalog/setup`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name: "Store", slug: "store", ownerId: "2" }),
  });
  assert.equal(response.status, 400);
});
test("store listing is scoped to the authenticated owner", async () => {
  let called = false;
  pool.query = (async (sql: string, params: unknown[]) => {
    if (sql.startsWith("SELECT token_version"))
      return { rows: [{ tokenVersion: 0 }] };
    assert.match(sql, /WHERE s.owner_id = \$1/);
    assert.deepEqual(params, ["1"]);
    called = true;
    return {
      rows: [
        {
          id: "9007199254740993",
          name: "Store",
          slug: "store",
          description: null,
          logoUrl: null,
          isActive: true,
          isPublished: false,
          accentColor: "#244d35",
        },
      ],
    };
  }) as typeof pool.query;
  try {
    const response = await fetch(`${base}/catalog/stores`, {
      headers: headers(),
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.stores[0].id, "9007199254740993");
    assert.equal(body.stores[0].slug, "store");
    assert.ok(called);
  } finally {
    pool.query = originalQuery;
  }
});
test("store creation uses the authenticated owner ID", async () => {
  pool.query = (async (sql: string, params: unknown[]) => {
    if (sql.startsWith("SELECT token_version"))
      return { rows: [{ tokenVersion: 0 }] };
    assert.match(sql, /INSERT INTO stores \(owner_id,/);
    assert.equal(params[0], "1");
    return { rows: [{ id: "42" }] };
  }) as typeof pool.query;
  try {
    const response = await fetch(`${base}/catalog/setup`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ name: "Store", slug: "store" }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).id, "42");
  } finally {
    pool.query = originalQuery;
  }
});
test("default store selection is scoped to the authenticated owner", async () => {
  pool.query = (async (sql: string, params: unknown[]) => {
    if (sql.startsWith("SELECT token_version"))
      return { rows: [{ tokenVersion: 0 }] };
    assert.match(sql, /s\.id = \$2 AND s\.owner_id = \$1/);
    assert.deepEqual(params, ["1", "42"]);
    return { rows: [{ ownerId: "1" }], rowCount: 1 };
  }) as typeof pool.query;
  try {
    const response = await fetch(`${base}/catalog/default-store/42`, {
      method: "PATCH",
      headers: headers(),
    });
    assert.equal(response.status, 204);
  } finally {
    pool.query = originalQuery;
  }
});
test("database failure returns a generic error rather than database details", async () => {
  pool.query = (async () => {
    throw new Error("secret database connection details");
  }) as typeof pool.query;
  try {
    const response = await fetch(`${base}/catalog/stores`, {
      headers: headers(),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      message: "Internal server error",
    });
  } finally {
    pool.query = originalQuery;
  }
});
test("malformed JSON returns a controlled 400", async () => {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { message: "Invalid JSON body" });
});
test("image uploads require authentication and reject unsupported or invalid files", async () => {
  assert.equal(
    (
      await fetch(`${base}/images`, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: "invalid image",
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await fetch(`${base}/images`, {
        method: "POST",
        headers: { ...headers(), "content-type": "image/svg+xml" },
        body: "<svg></svg>",
      })
    ).status,
    415,
  );
  assert.equal(
    (
      await fetch(`${base}/images`, {
        method: "POST",
        headers: {
          ...headers(),
          "content-type": "image/png",
          "x-image-kind": "product",
        },
        body: "invalid image",
      })
    ).status,
    400,
  );
});
test("store banners keep a wide aspect ratio when normalized to WebP", async () => {
  const source = await sharp({
    create: { width: 3200, height: 1200, channels: 3, background: "#b82752" },
  })
    .png()
    .toBuffer();
  const result = await sharp(await prepareImage(source, "banner")).metadata();
  assert.equal(result.format, "webp");
  assert.equal(result.width, 1920);
  assert.equal(result.height, 720);
});
test("GCash configuration requires valid account details when enabled", () => {
  assert.equal(
    catalogStoreSettingsSchema.safeParse({
      name: "Corner Shop",
      paymentMethods: ["CASH"],
    }).success,
    true,
  );
  assert.equal(
    catalogStoreSettingsSchema.safeParse({
      name: "Corner Shop",
      paymentMethods: ["GCASH"],
    }).success,
    false,
  );
  assert.equal(
    catalogStoreSettingsSchema.safeParse({
      name: "Corner Shop",
      paymentMethods: ["GCASH"],
      gcashAccountName: "Corner Shop",
      gcashNumber: "09171234567",
      gcashQrUrl: "/api/images/test/123e4567-e89b-12d3-a456-426614174000.webp",
    }).success,
    true,
  );
});
test("payment QR images are normalized to a square upload size", async () => {
  const source = await sharp({
    create: { width: 1800, height: 1800, channels: 3, background: "#ffffff" },
  })
    .png()
    .toBuffer();
  const result = await sharp(
    await prepareImage(source, "payment-qr"),
  ).metadata();
  assert.equal(result.format, "webp");
  assert.equal(result.width, 1000);
  assert.equal(result.height, 1000);
});
test("schemas preserve bigint IDs and reject invalid input", () => {
  assert.equal(idSchema.parse("9007199254740993"), "9007199254740993");
  for (const value of ["0", "-1", "1.5", "9223372036854775808", 1])
    assert.equal(idSchema.safeParse(value).success, false);
  assert.equal(
    setupStoreSchema.safeParse({ name: "  ", slug: "bad slug" }).success,
    false,
  );
  assert.equal(
    setupStoreSchema.safeParse({
      name: "Store",
      slug: "store",
      businessId: "1",
    }).success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({
      storeId: "1",
      items: [{ productId: "2", quantity: 0 }],
    }).success,
    false,
  );
  assert.equal(
    registerSchema.safeParse({
      name: "Owner",
      email: "owner@example.com",
      password: "😀".repeat(19),
    }).success,
    false,
  );
});

test("mobile numbers are optional for checkout while delivery still needs an address", () => {
  const dineInOrder = {
    storeSlug: "cafe",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    customerName: "Customer",
    orderType: "DINE_IN",
    paymentMethod: "CASH",
    items: [{ productId: "1", variantId: null, quantity: 1 }],
  };
  assert.equal(
    createOrderSchema.safeParse({ ...dineInOrder, tableNumber: "12" }).success,
    true,
  );
  assert.equal(createOrderSchema.safeParse(dineInOrder).success, true);
  assert.equal(
    createOrderSchema.safeParse({ ...dineInOrder, paymentMethod: "CRYPTO" })
      .success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "PICKUP",
    }).success,
    true,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "PICKUP",
      customerPhone: "09171234567",
    }).success,
    true,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "PICKUP",
      customerPhone: "09171234567",
      tableNumber: "12",
    }).success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "DELIVERY",
      deliveryAddress: "12 Market Street",
    }).success,
    true,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "DELIVERY",
    }).success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "PICKUP",
      customerPhone: "not-a-phone",
    }).success,
    false,
  );
});

test("product price validates decimal precision and database range", () => {
  const product = { categoryId: "1", name: "Burger", price: "12.50" };
  assert.equal(createProductSchema.parse(product).price, "12.50");
  for (const price of ["12.555", "100000000.00", "-1", "0", 12.5]) {
    assert.equal(
      createProductSchema.safeParse({ ...product, price }).success,
      false,
    );
  }
});
test("catalog items accept one price or distinct priced options", () => {
  const item = { categoryId: "1", name: "Coffee" };
  assert.equal(
    catalogItemSchema.safeParse({ ...item, price: "120" }).success,
    true,
  );
  assert.equal(catalogItemSchema.safeParse(item).success, false);
  assert.equal(
    catalogItemSchema.safeParse({
      ...item,
      variants: [
        { label: "Small", price: "90" },
        { label: "Large", price: "120" },
      ],
    }).success,
    true,
  );
  assert.equal(
    catalogItemSchema.safeParse({
      ...item,
      variants: [
        { label: "Small", price: "90" },
        { label: "small", price: "120" },
      ],
    }).success,
    false,
  );
  assert.equal(
    catalogItemSchema.safeParse({
      ...item,
      variants: [{ label: "6 pcs", price: "0" }],
    }).success,
    false,
  );
});
test("catalog images accept uploaded paths and HTTPS URLs only", () => {
  assert.equal(
    imageUrlSchema.safeParse(
      "/api/images/123e4567-e89b-12d3-a456-426614174000.webp",
    ).success,
    true,
  );
  assert.equal(
    imageUrlSchema.safeParse(
      "/api/images/development/123e4567-e89b-12d3-a456-426614174000.webp",
    ).success,
    true,
  );
  assert.equal(
    imageUrlSchema.safeParse(
      "/api/images/production/123e4567-e89b-12d3-a456-426614174000.webp",
    ).success,
    true,
  );
  assert.equal(
    imageUrlSchema.safeParse("https://example.com/product.png").success,
    true,
  );
  for (const value of [
    "/api/images/../secret",
    "/api/images/invalid_prefix/123e4567-e89b-12d3-a456-426614174000.webp",
    "http://example.com/a.png",
    "javascript:alert(1)",
  ])
    assert.equal(imageUrlSchema.safeParse(value).success, false);
});

test("image object keys stay in their environment path", async () => {
  const { imageObjectKey } =
    await import("../src/modules/images/images.service.js");
  const name = "123e4567-e89b-12d3-a456-426614174000.webp";
  assert.equal(
    imageObjectKey(name, "development"),
    `images/development/${name}`,
  );
  assert.equal(imageObjectKey(name, "production"), `images/production/${name}`);
  assert.equal(imageObjectKey(name), `images/${name}`);
  assert.throws(() => imageObjectKey(name, "../production"));
});
test("environment validation rejects unsafe startup defaults", async () => {
  const { envSchema } = await import("../src/config/env.js");
  const valid = {
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  };
  assert.equal(envSchema.safeParse(valid).success, true);
  assert.equal(
    envSchema.safeParse({ ...valid, JWT_SECRET: "dev-secret" }).success,
    false,
  );
  assert.equal(
    envSchema.safeParse({ ...valid, DATABASE_URL: "https://example.com" })
      .success,
    false,
  );
  assert.equal(envSchema.safeParse({ ...valid, PORT: 70000 }).success, false);
});
test("password hashing is available with installed native dependencies", async () => {
  const { default: bcrypt } = await import("bcrypt");
  const hash = await bcrypt.hash("a-test-password", 4);
  assert.equal(await bcrypt.compare("a-test-password", hash), true);
  assert.equal(await bcrypt.compare("wrong-password", hash), false);
});
