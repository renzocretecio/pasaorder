import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import type { Catalog } from "@pasaorder/types";
import {
  setupStoreSchema,
  catalogStoreSettingsSchema,
  createOrderSchema,
  createManualOrderSchema,
  createProductSchema,
  catalogItemSchema,
  orderWorkflowSchema,
  imageUrlSchema,
  idSchema,
  registerSchema,
} from "@pasaorder/validation";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";
const { default: app } = await import("../src/app.js");
const { envSchema } = await import("../src/config/env.js");
const { pool } = await import("../src/db.js");
const { signToken } = await import("../src/middleware/auth.js");
const { prepareImage } =
  await import("../src/modules/images/images.service.js");
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
  for (const route of [
    "meta/webhook",
    "public/chats/test",
    "orders/chat-drafts/test",
  ]) {
    assert.equal((await fetch(`${base}/${route}`)).status, 404);
  }
});
test("one private R2 bucket can back public image routes and private order files", () => {
  const parsed = envSchema.safeParse({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    JWT_SECRET: "test-secret-only-for-tests-32-characters",
    WEB_ORIGIN: "http://localhost:3000",
    R2_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    R2_BUCKET_NAME: "pasaorder-files",
    R2_ACCESS_KEY_ID: "test-access-key",
    R2_SECRET_ACCESS_KEY: "test-secret-key",
  });
  assert.equal(parsed.success, true);
});
test("public store listing exposes only published menu slugs", async () => {
  const previousQuery = pool.query;
  let executedSql = "";
  pool.query = (async (sql: string) => {
    executedSql = sql;
    return { rows: [{ slug: "coffee-shop" }] };
  }) as typeof pool.query;
  try {
    const response = await fetch(`${base}/public/stores`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      stores: [{ slug: "coffee-shop" }],
    });
    assert.match(executedSql, /is_active = true AND is_published = true/);
  } finally {
    pool.query = previousQuery;
  }
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
  const scheduledFor = new Date(Date.now() + 60 * 60_000).toISOString();
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "PICKUP",
      scheduledFor,
    }).success,
    true,
  );
  assert.equal(
    createOrderSchema.safeParse({ ...dineInOrder, scheduledFor }).success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({
      ...dineInOrder,
      orderType: "PICKUP",
      scheduledFor: new Date(Date.now() - 60_000).toISOString(),
    }).success,
    false,
  );
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

test("manual order requests retain price snapshots for safe offline sync", () => {
  const request = {
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    customerName: "Walk-in Customer",
    orderType: "PICKUP",
    paymentMethod: "CASH",
    items: [
      {
        productId: "1",
        variantId: null,
        quantity: 2,
        expectedUnitPrice: "120.00",
      },
    ],
  };
  assert.equal(createManualOrderSchema.safeParse(request).success, true);
  assert.equal(
    createManualOrderSchema.safeParse({
      ...request,
      items: [{ ...request.items[0], expectedUnitPrice: "not-a-price" }],
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
test("catalog items and checkout support priced extras and custom answers", () => {
  const item = {
    categoryId: "1",
    name: "Gift box",
    price: "100.00",
    addOnGroups: [
      {
        id: "123e4567-e89b-42d3-a456-426614174001",
        name: "Wrapping",
        selection: "SINGLE",
        required: true,
        options: [
          {
            id: "123e4567-e89b-42d3-a456-426614174002",
            name: "Premium paper",
            price: "15.00",
          },
        ],
      },
    ],
  };
  assert.equal(catalogItemSchema.safeParse(item).success, true);
  const baseOrder = {
    storeSlug: "gift-shop",
    idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
    customerName: "Customer",
    orderType: "PICKUP",
    paymentMethod: "CASH",
    formAnswers: [
      { questionId: "123e4567-e89b-42d3-a456-426614174003", value: "Tomorrow" },
    ],
    items: [
      {
        productId: "1",
        variantId: null,
        quantity: 1,
        addOns: [
          {
            groupId: item.addOnGroups[0].id,
            optionId: item.addOnGroups[0].options[0].id,
          },
        ],
      },
    ],
  };
  assert.equal(createOrderSchema.safeParse(baseOrder).success, true);
  assert.equal(
    createOrderSchema.safeParse({
      ...baseOrder,
      items: [
        {
          ...baseOrder.items[0],
          addOns: [{ groupId: "bad", optionId: "bad" }],
        },
      ],
    }).success,
    false,
  );
});
test("product order forms accept numeric and checkbox questions and answers", () => {
  const numericQuestionId = "123e4567-e89b-42d3-a456-426614174010";
  const checkboxQuestionId = "123e4567-e89b-42d3-a456-426614174011";
  const fileQuestionId = "123e4567-e89b-42d3-a456-426614174012";
  const product = {
    categoryId: "1",
    name: "Custom cake",
    price: "500",
    orderQuestions: [
      {
        id: numericQuestionId,
        label: "How many servings?",
        placeholder: "For example, 8",
        type: "NUMBER",
        required: true,
        options: [],
      },
      {
        id: checkboxQuestionId,
        label: "Add a greeting card",
        type: "CHECKBOX",
        required: false,
        options: [],
      },
      {
        id: fileQuestionId,
        label: "Reference artwork",
        type: "FILE",
        required: true,
        options: [],
      },
    ],
  };
  const parsedProduct = catalogItemSchema.parse(product);
  assert.equal(parsedProduct.orderQuestions[0].placeholder, "For example, 8");
  assert.equal(parsedProduct.orderQuestions[1].placeholder, undefined);
  assert.equal(
    catalogItemSchema.safeParse({
      ...product,
      orderQuestions: [
        { ...product.orderQuestions[1], options: ["Yes", "No"] },
      ],
    }).success,
    false,
  );
  assert.equal(
    createOrderSchema.safeParse({
      storeSlug: "cake-shop",
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174000",
      customerName: "Customer",
      orderType: "PICKUP",
      paymentMethod: "CASH",
      items: [
        {
          productId: "1",
          variantId: null,
          quantity: 1,
          productAnswers: [
            { questionId: numericQuestionId, value: "12" },
            { questionId: checkboxQuestionId, value: "true" },
          ],
        },
      ],
    }).success,
    true,
  );
});
test("order workflows keep terminal cancellation fixed and require distinct stage labels", () => {
  const workflow = {
    template: "RETAIL",
    labels: {
      NEW: "New",
      CONFIRMED: "Confirmed",
      PREPARING: "Packing",
      READY: "Shipped",
      COMPLETED: "Fulfilled",
      CANCELLED: "Cancelled",
    },
  };
  assert.equal(orderWorkflowSchema.safeParse(workflow).success, true);
  assert.equal(
    orderWorkflowSchema.safeParse({
      ...workflow,
      labels: { ...workflow.labels, READY: "Packing" },
    }).success,
    false,
  );
  assert.equal(
    orderWorkflowSchema.safeParse({
      ...workflow,
      labels: { ...workflow.labels, CANCELLED: "Stopped" },
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
