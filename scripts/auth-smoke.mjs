import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
const root = fileURLToPath(new URL("../", import.meta.url)).replace(/\/$/, "");
const require = createRequire(root + "/apps/api/package.json");
require("dotenv").config({ path: root + "/apps/api/.env", quiet: true });
const { createDatabase } = await import(
  new URL("../packages/db/dist/index.js", import.meta.url)
);
const { pool } = createDatabase(process.env.DATABASE_URL);
async function availablePort() {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
const apiPort = await availablePort(),
  webPort = await availablePort();
const email = `auth-smoke-${randomUUID()}@example.com`,
  password = "Test-owner-password-2026";
const api = spawn(process.execPath, ["dist/server.js"], {
  cwd: root + "/apps/api",
  env: { ...process.env, PORT: String(apiPort), NODE_ENV: "test" },
  stdio: ["ignore", "pipe", "pipe"],
});
const web = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "start",
    "-p",
    String(webPort),
    "-H",
    "127.0.0.1",
  ],
  {
    cwd: root + "/apps/web",
    env: {
      ...process.env,
      NODE_ENV: "production",
      API_URL: `http://127.0.0.1:${apiPort}/api`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
for (const child of [api, web]) {
  child.stdout.on("data", () => {});
  child.stderr.on("data", () => {});
}
const webUrl = `http://127.0.0.1:${webPort}`;
const decode = (value) =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
function form(html, fields = {}) {
  const data = new FormData();
  for (const input of html.match(/<input\b[^>]*>/g) ?? []) {
    const name = input.match(/\bname="([^"]*)"/)?.[1],
      value = input.match(/\bvalue="([^"]*)"/)?.[1] ?? "";
    if (name?.startsWith("$ACTION_")) data.append(decode(name), decode(value));
  }
  assert.ok([...data.keys()].length, "Server Action hidden inputs are present");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}
async function wait(url) {
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.status < 500) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start");
}
let cookie;
try {
  await Promise.all([
    wait(`http://127.0.0.1:${apiPort}/api/health`),
    wait(webUrl + "/login"),
  ]);
  const anonymous = await fetch(webUrl + "/dashboard", { redirect: "manual" });
  assert.equal(anonymous.status, 307);
  assert.equal(anonymous.headers.get("location"), "/login");
  const registerPage = await fetch(webUrl + "/register");
  assert.equal(registerPage.status, 200);
  const html = await registerPage.text();
  assert.ok(html.includes("Confirm password"));
  const mismatch = await fetch(webUrl + "/register", {
    method: "POST",
    headers: { origin: webUrl },
    body: form(html, {
      name: "Auth Smoke Owner",
      email,
      password,
      confirmPassword: "different-password",
    }),
    redirect: "manual",
  });
  assert.equal(mismatch.status, 200);
  assert.ok((await mismatch.text()).includes("Passwords don’t match."));
  const registration = await fetch(webUrl + "/register", {
    method: "POST",
    headers: { origin: webUrl },
    body: form(html, {
      name: "Auth Smoke Owner",
      email,
      password,
      confirmPassword: password,
    }),
    redirect: "manual",
  });
  assert.equal(registration.status, 303);
  assert.equal(registration.headers.get("location"), "/dashboard");
  const setCookie = registration.headers.get("set-cookie");
  assert.ok(setCookie?.includes("HttpOnly"));
  assert.ok(setCookie.includes("SameSite=lax"));
  assert.ok(setCookie.includes("Secure"));
  cookie = setCookie.split(";")[0];
  const dashboard = await fetch(webUrl + "/dashboard", {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(dashboard.status, 200);
  const dashboardHtml = await dashboard.text();
  assert.ok(dashboardHtml.includes("Auth Smoke Owner"));
  assert.ok(dashboardHtml.includes(email));
  assert.ok(
    !dashboardHtml.includes(cookie.split("=")[1]),
    "JWT not exposed in dashboard HTML",
  );
  const authenticatedLogin = await fetch(webUrl + "/login", {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(authenticatedLogin.headers.get("location"), "/dashboard");
  const logout = await fetch(webUrl + "/dashboard", {
    method: "POST",
    headers: { cookie, origin: webUrl },
    body: form(dashboardHtml),
    redirect: "manual",
  });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get("location"), "/login");
  assert.match(
    logout.headers.get("set-cookie") ?? "",
    /Max-Age=0|Expires=Thu, 01 Jan 1970/i,
  );
  const revoked = await fetch(`http://127.0.0.1:${apiPort}/api/auth/me`, {
    headers: {
      authorization: "Bearer " + cookie.slice(cookie.indexOf("=") + 1),
    },
  });
  assert.equal(revoked.status, 401);
  const expiredDashboard = await fetch(webUrl + "/dashboard", {
    headers: { cookie },
    redirect: "manual",
  });
  assert.equal(expiredDashboard.headers.get("location"), "/login");
  const loginHtml = await (await fetch(webUrl + "/login")).text();
  const failedLogin = await fetch(webUrl + "/login", {
    method: "POST",
    headers: { origin: webUrl },
    body: form(loginHtml, { email, password: "wrong-password" }),
    redirect: "manual",
  });
  assert.equal(failedLogin.status, 200);
  assert.ok((await failedLogin.text()).includes("Invalid credentials"));
  const login = await fetch(webUrl + "/login", {
    method: "POST",
    headers: { origin: webUrl },
    body: form(loginHtml, { email, password }),
    redirect: "manual",
  });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get("location"), "/dashboard");
  console.log(
    "PASS: built web forms → real API/PostgreSQL registration and login; HttpOnly/Secure cookie; anonymous and authenticated redirects; dashboard identity; logout cookie removal and token revocation.",
  );
} finally {
  await pool.query("DELETE FROM users WHERE email = $1", [email]);
  await pool.end();
  for (const child of [api, web]) {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      if (child.exitCode !== null) return resolve();
      child.once("exit", resolve);
      setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5000).unref();
    });
  }
  console.log(
    "Removed the temporary test account and stopped both test servers.",
  );
}
