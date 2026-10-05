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
const email = `catalog-smoke-${randomUUID()}@example.com`,
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
function form(html, fields = {}, marker) {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/g) ?? [];
  html = forms.find((value) => value.includes(`name="${marker}"`));
  assert.ok(html, `Form containing ${marker} exists`);
  const data = new FormData();
  for (const input of html.match(/<input\b[^>]*>/g) ?? []) {
    const name = input.match(/\bname="([^"]*)"/)?.[1],
      value = input.match(/\bvalue="([^"]*)"/)?.[1] ?? "";
    if (name?.startsWith("$ACTION_") || name?.startsWith("_"))
      data.append(decode(name), decode(value));
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
const apiUrl = `http://127.0.0.1:${apiPort}/api`;
const otherEmail = `catalog-other-${randomUUID()}@example.com`;
const slug = `smoke-${randomUUID()}`;
async function request(path, token, method = "GET", body) {
  const response = await fetch(apiUrl + path, {
    method,
    signal: AbortSignal.timeout(15000),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: response.status === 204 ? null : await response.json(),
  };
}
let cookie;
async function page(path) {
  return await (
    await fetch(webUrl + path, {
      headers: { cookie },
      signal: AbortSignal.timeout(15000),
    })
  ).text();
}
async function submit(path, html, marker, fields) {
  return fetch(webUrl + path, {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: { cookie, origin: webUrl },
    body: form(html, fields, marker),
    redirect: "manual",
  });
}
try {
  await Promise.all([wait(apiUrl + "/health"), wait(webUrl + "/login")]);
  const owner = await request("/auth/register", null, "POST", {
    name: "Catalog Smoke Owner",
    email,
    password,
  });
  const other = await request("/auth/register", null, "POST", {
    name: "Other Owner",
    email: otherEmail,
    password,
  });
  assert.equal(owner.status, 201);
  assert.equal(other.status, 201);
  const token = owner.data.token;
  const otherToken = other.data.token;
  cookie = `pasaorder_session=${token}`;
  const setupHtml = await page("/dashboard/new");
  assert.doesNotMatch(setupHtml, /name="business(?:Id|Name)"/);
  const setup = await submit("/dashboard/new", setupHtml, "slug", {
    name: "Luna Catalog",
    slug,
    description: "Everyday goods, thoughtfully chosen.",
    contactPhone: "+63 912 345 6789",
    address: "12 Market Road, Manila",
    hours_monday_open: "on",
    hours_monday_opens: "09:00",
    hours_monday_closes: "18:00",
    logoUrl: "",
    bannerUrl: "https://example.com/setup-banner.jpg",
    accentColor: "#e7a856",
  });
  assert.equal(setup.status, 303);
  const path = setup.headers.get("location");
  assert.match(path, /^\/dashboard\/stores\/\d+$/);
  const storeId = path.split("/").at(-1);
  let catalog = (await request(`/catalog/stores/${storeId}`, token)).data;
  assert.equal(catalog.store.isPublished, false);
  assert.equal(catalog.store.accentColor, "#e7a856");
  assert.equal(catalog.store.bannerUrl, "https://example.com/setup-banner.jpg");
  assert.equal(catalog.store.contactPhone, "+63 912 345 6789");
  assert.equal(catalog.store.address, "12 Market Road, Manila");
  assert.equal(catalog.store.operatingHours[0].opens, "09:00");
  assert.equal(catalog.store.operatingHours[1].open, false);
  assert.equal((await request(`/public/stores/${slug}`)).status, 404);
  assert.ok(
    (await page(path + "/preview")).includes("This catalog is private"),
  );
  assert.equal(
    (
      await request(`/catalog/stores/${storeId}/publication`, token, "POST", {
        isPublished: true,
      })
    ).status,
    400,
  );
  const storeCount = (await request("/catalog/stores", token)).data.stores
    .length;
  assert.equal(
    (
      await request("/catalog/setup", token, "POST", {
        name: "Duplicate store",
        slug,
      })
    ).status,
    409,
  );
  assert.equal(
    (await request("/catalog/stores", token)).data.stores.length,
    storeCount,
    "Duplicate link creates no extra store",
  );
  const categoryPath = path + "/categories/new";
  const categorySave = await submit(
    categoryPath,
    await page(categoryPath),
    "sortOrder",
    { name: "Daily essentials", sortOrder: "0" },
  );
  assert.equal(categorySave.status, 303);
  assert.equal(categorySave.headers.get("location"), path);
  catalog = (await request(`/catalog/stores/${storeId}`, token)).data;
  const categoryId = catalog.categories[0].id;
  const itemPath = path + "/items/new";
  const itemHtml = await page(itemPath);
  const invalidItem = await submit(itemPath, itemHtml, "price", {
    categoryId,
    name: "Canvas tote",
    description: "",
    price: "0",
    imageUrl: "",
    sortOrder: "0",
    isAvailable: "on",
  });
  assert.equal(invalidItem.status, 200);
  assert.ok((await invalidItem.text()).includes("Price must be positive"));
  const itemSave = await submit(itemPath, itemHtml, "price", {
    categoryId,
    name: "Canvas tote",
    description: "Room for your daily essentials.",
    price: "250.50",
    imageUrl: "",
    sortOrder: "0",
    isAvailable: "on",
  });
  assert.equal(itemSave.status, 303);
  catalog = (await request(`/catalog/stores/${storeId}`, token)).data;
  const itemId = catalog.categories[0].items[0].id;
  const publication = await submit(path, await page(path), "isPublished", {
    isPublished: "true",
  });
  assert.equal(publication.status, 200);
  assert.ok((await publication.text()).includes("Catalog published"));
  const publicResult = await request(`/public/stores/${slug}`);
  assert.equal(publicResult.status, 200);
  assert.equal(publicResult.data.categories[0].items[0].price, "250.50");
  const publicHtml = await (await fetch(webUrl + `/menu/${slug}`)).text();
  assert.ok(publicHtml.includes("Canvas tote"));
  assert.ok(publicHtml.includes("250.50"));
  assert.ok(!publicHtml.includes(email));
  assert.ok(!publicHtml.includes(token));
  for (const [endpoint, method, body] of [
    [`/catalog/stores/${storeId}`, "GET"],
    [
      `/catalog/stores/${storeId}`,
      "PATCH",
      { name: "Hijack", accentColor: "#ffffff" },
    ],
    [`/catalog/stores/${storeId}/categories`, "POST", { name: "Hijack" }],
    [
      `/catalog/stores/${storeId}/categories/${categoryId}`,
      "PATCH",
      { name: "Hijack" },
    ],
    [
      `/catalog/stores/${storeId}/items`,
      "POST",
      { categoryId, name: "Hijack", price: "1" },
    ],
    [
      `/catalog/stores/${storeId}/items/${itemId}`,
      "PATCH",
      { categoryId, name: "Hijack", price: "1" },
    ],
    [`/catalog/stores/${storeId}/publication`, "POST", { isPublished: false }],
  ])
    assert.equal(
      (await request(endpoint, otherToken, method, body)).status,
      404,
      endpoint,
    );
  const second = await request("/catalog/setup", token, "POST", {
    name: "Second store",
    slug: `second-${slug}`,
  });
  assert.equal(second.status, 201);
  assert.equal(
    (await request(`/catalog/stores/${second.data.id}`, otherToken)).status,
    404,
  );
  const secondCategory = await request(
    `/catalog/stores/${second.data.id}/categories`,
    token,
    "POST",
    { name: "Another category" },
  );
  assert.equal(
    (
      await request(
        `/catalog/stores/${storeId}/items/${itemId}`,
        token,
        "PATCH",
        {
          categoryId: secondCategory.data.id,
          name: "Canvas tote",
          price: "250.50",
        },
      )
    ).status,
    404,
    "Items cannot move across stores",
  );
  assert.equal(
    (
      await request(`/catalog/stores/${storeId}`, token, "PATCH", {
        name: "Renamed catalog",
        accentColor: "#ffffff",
        slug: "changed",
      })
    ).status,
    400,
    "Menu slug is immutable",
  );
  const settingsPath = path + "/settings";
  assert.equal(
    (
      await submit(settingsPath, await page(settingsPath), "accentColor", {
        name: "Renamed catalog",
        description: "Updated description",
        contactPhone: "+63 917 123 4567",
        address: "34 New Street, Manila",
        hours_friday_open: "on",
        hours_friday_opens: "22:00",
        hours_friday_closes: "02:00",
        logoUrl: "",
        bannerUrl: "https://example.com/profile-banner.jpg",
        accentColor: "#ffffff",
      })
    ).status,
    303,
  );
  const updated = (await request(`/public/stores/${slug}`)).data;
  assert.equal(updated.store.name, "Renamed catalog");
  assert.equal(updated.store.accentColor, "#ffffff");
  assert.equal(
    updated.store.bannerUrl,
    "https://example.com/profile-banner.jpg",
  );
  assert.equal(updated.store.contactPhone, "+63 917 123 4567");
  assert.equal(updated.store.address, "34 New Street, Manila");
  assert.equal(updated.store.operatingHours[4].opens, "22:00");
  assert.equal(updated.store.operatingHours[4].closes, "02:00");
  const publicMenu = await page(`/menu/${slug}`);
  assert.match(publicMenu, /34 New Street, Manila/);
  assert.match(publicMenu, /Operating hours/);
  assert.match(publicMenu, /profile-banner.jpg/);
  assert.match(publicMenu, /next day/);
  assert.equal(updated.store.slug, slug);
  const edited = await submit(
    path + `/items/${itemId}`,
    await page(path + `/items/${itemId}`),
    "price",
    {
      categoryId,
      name: "Canvas tote",
      description: "",
      price: "260",
      imageUrl: "",
      sortOrder: "0",
    },
  );
  assert.equal(edited.status, 303);
  assert.equal(
    (await request(`/public/stores/${slug}`)).status,
    404,
    "Last unavailable item unpublishes the catalog",
  );
  catalog = (await request(`/catalog/stores/${storeId}`, token)).data;
  assert.equal(catalog.store.isPublished, false);
  assert.equal(
    (
      await request(
        `/catalog/stores/${storeId}/items/${itemId}`,
        token,
        "PATCH",
        { categoryId, name: "Canvas tote", price: "260", isAvailable: true },
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(`/catalog/stores/${storeId}/publication`, token, "POST", {
        isPublished: true,
      })
    ).status,
    204,
  );
  assert.equal(
    (
      await request(`/catalog/stores/${storeId}/publication`, token, "POST", {
        isPublished: false,
      })
    ).status,
    204,
  );
  const coffee = await request(
    `/catalog/stores/${storeId}/items`,
    token,
    "POST",
    {
      categoryId,
      name: "Iced coffee",
      variants: [
        { label: "Small", price: "90" },
        { label: "Large", price: "120" },
      ],
    },
  );
  assert.equal(coffee.status, 201);
  catalog = (await request(`/catalog/stores/${storeId}`, token)).data;
  let coffeeItem = catalog.categories[0].items.find(
    (item) => item.id === coffee.data.id,
  );
  assert.equal(coffeeItem.price, "90.00");
  assert.deepEqual(
    coffeeItem.variants.map((variant) => variant.label),
    ["Small", "Large"],
  );
  const smallId = coffeeItem.variants[0].id;
  assert.equal(
    (
      await request(
        `/catalog/stores/${storeId}/items/${itemId}`,
        token,
        "PATCH",
        {
          categoryId,
          name: "Canvas tote",
          variants: [{ id: smallId, label: "Small", price: "90" }],
        },
      )
    ).status,
    404,
    "An option cannot be moved to another item",
  );
  assert.equal(
    (
      await request(
        `/catalog/stores/${storeId}/items/${coffee.data.id}`,
        token,
        "PATCH",
        {
          categoryId,
          name: "Iced coffee",
          variants: [
            { id: smallId, label: "Small", price: "95" },
            { label: "Medium", price: "110" },
          ],
        },
      )
    ).status,
    200,
  );
  catalog = (await request(`/catalog/stores/${storeId}`, token)).data;
  coffeeItem = catalog.categories[0].items.find(
    (item) => item.id === coffee.data.id,
  );
  assert.equal(coffeeItem.price, "95.00");
  assert.equal(coffeeItem.variants[0].id, smallId);
  assert.deepEqual(
    coffeeItem.variants.map((variant) => variant.label),
    ["Small", "Medium"],
  );
  assert.equal(
    (
      await request(`/catalog/stores/${storeId}/publication`, token, "POST", {
        isPublished: true,
      })
    ).status,
    204,
  );
  const variantMenu = await (await fetch(webUrl + `/menu/${slug}`)).text();
  assert.ok(variantMenu.includes("Small"));
  assert.ok(variantMenu.includes("Medium"));
  assert.ok(variantMenu.includes("₱95.00"));
  assert.equal(
    (
      await request(`/catalog/stores/${storeId}/publication`, token, "POST", {
        isPublished: false,
      })
    ).status,
    204,
  );
  assert.equal((await request(`/public/stores/${slug}`)).status, 404);
  assert.equal((await request(`/catalog/stores/${storeId}`)).status, 401);
  console.log(
    "PASS: real web forms → PostgreSQL catalog editing, priced item options, public menu display, validation, publishing, owner/item isolation, and unpublishing.",
  );
} finally {
  await pool.query("DELETE FROM users WHERE email = ANY($1::text[])", [
    [email, otherEmail],
  ]);
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
    "Removed temporary catalog accounts and their stores; stopped test servers.",
  );
}
