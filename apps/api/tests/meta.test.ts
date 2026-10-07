import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH = "/dev/null";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "meta-test-secret-at-least-32-characters";
process.env.META_GRAPH_API_VERSION = "v26.0";

const { getMessengerCustomerName, sendMessengerText } =
  await import("../src/modules/meta/meta.service.js");

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
