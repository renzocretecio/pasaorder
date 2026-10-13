import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "meta-test-secret-at-least-32-characters";
process.env.META_GRAPH_API_VERSION = "v26.0";
process.env.META_APP_ID = "meta-test-app";
process.env.META_APP_SECRET = "meta-test-secret";
process.env.META_WEBHOOK_VERIFY_TOKEN = "meta-webhook-test-token";
process.env.META_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
process.env.META_REDIRECT_URI =
  "https://api.example.test/api/meta/oauth/callback";

const {
  getInstagramCustomerName,
  getMessengerCustomerName,
  makeMetaLoginUrl,
  sendInstagramText,
  sendMessengerText,
  verifyMetaOAuthState,
} = await import("../src/modules/meta/meta.service.js");

test("Instagram connection requests only the account and messaging permissions", () => {
  const url = new URL(makeMetaLoginUrl("11", "12", "INSTAGRAM"));
  assert.equal(url.hostname, "www.facebook.com");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    process.env.META_REDIRECT_URI,
  );
  assert.deepEqual(
    url.searchParams.get("scope")?.split(",").sort(),
    [
      "instagram_basic",
      "instagram_manage_messages",
      "pages_manage_metadata",
      "pages_show_list",
    ].sort(),
  );
  assert.deepEqual(verifyMetaOAuthState(url.searchParams.get("state")!), {
    ownerId: "11",
    storeId: "12",
    channel: "INSTAGRAM",
  });
});

test("Messenger profile lookup returns the available first and last name", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/v26.0/12345");
    assert.equal(url.searchParams.get("fields"), "first_name,last_name");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer page-token",
    );
    return Response.json({ first_name: "Ana", last_name: "Santos" });
  }) as typeof fetch;

  assert.equal(
    await getMessengerCustomerName("12345", "page-token"),
    "Ana Santos",
  );
});

test("Messenger replies use the connected Page Send API", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/v26.0/98765/messages");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer page-token",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      recipient: { id: "12345" },
      message: { text: "Hi, thanks for your message!" },
      messaging_type: "RESPONSE",
    });
    return Response.json({ recipient_id: "12345", message_id: "mid.test" });
  }) as typeof fetch;

  await sendMessengerText(
    "98765",
    "12345",
    "Hi, thanks for your message!",
    "page-token",
  );
});

test("Instagram profile lookup returns the username when Meta exposes it", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/v26.0/54321");
    assert.equal(url.searchParams.get("fields"), "username");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer instagram-page-token",
    );
    return Response.json({ username: "cafepasaorder" });
  }) as typeof fetch;

  assert.equal(
    await getInstagramCustomerName("54321", "instagram-page-token"),
    "cafepasaorder",
  );
});

test("Instagram replies use the connected professional account Send API", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/v26.0/98765/messages");
    assert.equal(url.searchParams.get("platform"), "instagram");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer instagram-page-token",
    );
    assert.deepEqual(JSON.parse(String(init?.body)), {
      recipient: { id: "ig-12345" },
      message: { text: "Thanks for reaching out!" },
    });
    return Response.json({
      recipient_id: "ig-12345",
      message_id: "ig.mid.test",
    });
  }) as typeof fetch;

  await sendInstagramText(
    "98765",
    "ig-12345",
    "Thanks for reaching out!",
    "instagram-page-token",
  );
});
