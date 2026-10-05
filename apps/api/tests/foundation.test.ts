import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import sharp from "sharp";
import {
  setupStoreSchema,
  catalogStoreSettingsSchema,
  createOrderSchema,
  createProductSchema,
  catalogItemSchema,
  imageUrlSchema,
  idSchema,
  registerSchema,
} from "@pasaorder/validation";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-secret-only-for-tests-32-characters";
process.env.WEB_ORIGIN = "http://localhost:3000";
const { default: app } = await import("../src/app.js");
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

test("dine-in orders do not require a phone number and accept an optional table", () => {
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
    false,
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
