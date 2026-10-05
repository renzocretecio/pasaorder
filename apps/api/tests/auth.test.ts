import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import type { Server } from "node:http";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { registerSchema } from "@pasaorder/validation";
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "auth-test-secret-at-least-32-characters";
const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/db.js");
const { createAuthRateLimit } =
  await import("../src/middleware/auth-rate-limit.js");
const realQuery = pool.query;
let server: Server;
let base: string;
let user:
  | {
      id: string;
      name: string;
      email: string;
      passwordHash: string;
      tokenVersion: number;
      createdAt: Date;
    }
  | undefined;
let token: string;
before(async () => {
  pool.query = (async (sql: string, params: unknown[]) => {
    if (sql.startsWith("SELECT token_version"))
      return {
        rows:
          user && params[0] === user.id
            ? [{ tokenVersion: user.tokenVersion }]
            : [],
      };
    if (sql.includes("WHERE email = $1"))
      return { rows: user && params[0] === user.email ? [user] : [] };
    if (sql.includes("INSERT INTO users")) {
      user = {
        id: "1",
        email: String(params[0]),
        passwordHash: String(params[1]),
        name: String(params[2]),
        tokenVersion: 0,
        createdAt: new Date(),
      };
      return { rows: [user] };
    }
    if (sql.includes("UPDATE users SET token_version")) {
      assert.equal(params[0], user?.id);
      user!.tokenVersion += 1;
      return { rows: [{ id: user!.id }] };
    }
    if (sql.includes("WHERE id = $1"))
      return { rows: user && params[0] === user.id ? [user] : [] };
    throw new Error(`Unexpected query in auth test: ${sql}`);
  }) as typeof pool.query;
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  base = `http://127.0.0.1:${address.port}/api/auth`;
});
after(async () => {
  pool.query = realQuery;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await pool.end();
});
const post = (route: string, body: unknown) =>
  fetch(`${base}/${route}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
test("registration validates input, normalizes email and never returns the hash", async () => {
  assert.equal(
    (await post("register", { name: "Owner", email: "bad", password: "short" }))
      .status,
    400,
  );
  assert.equal(user, undefined);
  const response = await post("register", {
    name: "  Juan  ",
    email: "  OWNER@example.com  ",
    password: "long-enough-password",
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  token = result.token;
  assert.equal(result.user.name, "Juan");
  assert.equal(result.user.email, "owner@example.com");
  assert.equal(result.user.passwordHash, undefined);
  assert.equal(result.user.tokenVersion, undefined);
  assert.equal(
    await bcrypt.compare("long-enough-password", user!.passwordHash),
    true,
  );
  const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
  assert.equal(payload.sub, "1");
  assert.equal(payload.version, 0);
  assert.equal(
    (
      await post("register", {
        name: "Other",
        email: "OWNER@example.com",
        password: "another-password",
      })
    ).status,
    409,
  );
});
test("login returns generic credential errors and a valid current-user session", async () => {
  for (const email of ["unknown@example.com", "owner@example.com"]) {
    const response = await post("login", { email, password: "wrong-password" });
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { message: "Invalid credentials" });
  }
  const response = await post("login", {
    email: "owner@example.com",
    password: "long-enough-password",
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  const me = await fetch(`${base}/me`, {
    headers: { authorization: `Bearer ${result.token}` },
  });
  assert.equal(me.status, 200);
  assert.deepEqual((await me.json()).user, result.user);
});
test("logout invalidates old tokens and a new login restores access", async () => {
  assert.equal((await fetch(`${base}/logout`, { method: "POST" })).status, 401);
  assert.equal(
    (
      await fetch(`${base}/logout`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await fetch(`${base}/me`, {
        headers: { authorization: `Bearer ${token}` },
      })
    ).status,
    401,
  );
  const response = await post("login", {
    email: "owner@example.com",
    password: "long-enough-password",
  });
  const result = await response.json();
  assert.equal(
    (
      await fetch(`${base}/me`, {
        headers: { authorization: `Bearer ${result.token}` },
      })
    ).status,
    200,
  );
});
test("email normalization occurs before validation", () => {
  assert.equal(
    registerSchema.parse({
      name: "Juan",
      email: "  JUAN@example.com  ",
      password: "long-enough-password",
    }).email,
    "juan@example.com",
  );
});
test("auth throttling responds with a retry interval", async () => {
  const limitedApp = express();
  limitedApp.use(createAuthRateLimit(2));
  limitedApp.get("/", (_req, res) => res.sendStatus(200));
  const limitedServer = limitedApp.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) =>
    limitedServer.once("listening", resolve),
  );
  const address = limitedServer.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  try {
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 200);
    const blocked = await fetch(url);
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  } finally {
    await new Promise<void>((resolve) => limitedServer.close(() => resolve()));
  }
});
