import assert from "node:assert/strict";
import { test } from "node:test";
import {
  captureManualOrder,
  restoreManualOrders,
  syncManualOrderPass,
  manualSubtotal,
} from "../apps/web/features/orders/manual-order-queue.ts";

const payload = (suffix) => ({
  idempotencyKey: `123e4567-e89b-42d3-a456-42661417400${suffix}`,
  customerName: "Walk-in",
  orderType: "PICKUP",
  paymentMethod: "CASH",
  items: [
    {
      productId: "1",
      variantId: null,
      quantity: 2,
      expectedUnitPrice: "120.50",
    },
  ],
});

test("a price conflict pauses only its order and never retries on the next pass", async () => {
  let queue = [
    captureManualOrder(payload(1), ["Coffee"]),
    captureManualOrder(payload(2), ["Coffee"]),
  ];
  const calls = [];
  const send = async (input) => {
    calls.push(input.idempotencyKey);
    return input.idempotencyKey === payload(1).idempotencyKey
      ? { success: false, reviewable: true, message: "Price changed" }
      : { success: true, orderId: "42" };
  };
  const settle = (entry, result) => {
    queue = result.success
      ? queue.filter((item) => item.id !== entry.id)
      : queue.map((item) =>
          item.id === entry.id ? { ...item, state: "review" } : item,
        );
  };
  await syncManualOrderPass(queue, send, settle, () => true);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].state, "review");
  await syncManualOrderPass(queue, send, settle, () => true);
  assert.equal(calls.length, 2);
});

test("an uncertain response retains the same key through reload and retry", async () => {
  let queue = [captureManualOrder(payload(1), ["Coffee"])];
  await syncManualOrderPass(
    queue,
    async () => {
      throw new Error("response lost");
    },
    (entry, result) => {
      assert.equal(result.success, false);
      assert.equal(result.reviewable, false);
      queue = [{ ...entry, state: "retry", error: result.message }];
    },
    () => true,
  );
  queue = restoreManualOrders(JSON.stringify(queue));
  let calls = 0;
  await syncManualOrderPass(
    queue,
    async () => {
      calls++;
    },
    () => {},
    () => true,
  );
  assert.equal(calls, 0);
  queue[0].state = "waiting";
  await syncManualOrderPass(
    queue,
    async (input) => {
      assert.equal(input.idempotencyKey, payload(1).idempotencyKey);
      return { success: true, orderId: "42" };
    },
    (_, result) => assert.equal(result.success, true),
    () => true,
  );
});

test("legacy saved orders survive upgrade and captured totals use integer cents", () => {
  const old = {
    id: payload(1).idempotencyKey,
    payload: payload(1),
    savedAt: 123,
  };
  const [entry] = restoreManualOrders(JSON.stringify([old]));
  assert.equal(entry.state, "waiting");
  assert.deepEqual(entry.names, []);
  assert.equal(manualSubtotal(entry.payload), 24100);
  const revised = captureManualOrder(
    {
      ...entry.payload,
      items: [{ ...entry.payload.items[0], expectedUnitPrice: "130.00" }],
    },
    ["Coffee"],
    entry,
  );
  assert.equal(revised.id, entry.id);
  assert.equal(revised.savedAt, 123);
  assert.equal(manualSubtotal(revised.payload), 26000);
  const withoutPrice = {
    ...old,
    payload: {
      ...old.payload,
      items: [{ productId: "1", variantId: null, quantity: 1 }],
    },
  };
  assert.equal(
    restoreManualOrders(JSON.stringify([withoutPrice]))[0].state,
    "review",
  );
});

test("disconnected passes do not send and malformed storage is not silently discarded", async () => {
  await syncManualOrderPass(
    [captureManualOrder(payload(1), ["Coffee"])],
    async () => assert.fail("sent offline"),
    () => {},
    () => false,
  );
  assert.throws(() => restoreManualOrders("{broken"));
  assert.throws(() =>
    restoreManualOrders(
      JSON.stringify([{ id: "bad", payload: payload(1), savedAt: 123 }]),
    ),
  );
});
