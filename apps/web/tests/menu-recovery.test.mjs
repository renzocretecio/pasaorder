import assert from "node:assert/strict";
import test from "node:test";
import {
  CART_MAX_AGE,
  cartStorageKey,
  encodeCart,
  restoreCart,
  checkoutRequestKey,
  clearCheckoutRequest,
} from "../features/catalog/saved-cart.ts";

const now = 1800000000000;
const product = { id: "coffee", price: 120, isAvailable: true, variants: [] };
const catalog = (items = [product]) => ({ categories: [{ items }] });
const line = (item = product, variant = null) => ({
  key: "coffee::less ice",
  item,
  variant,
  quantity: 2,
  instructions: "less ice",
});

test("restores items and notes using current catalog prices", () => {
  const raw = encodeCart([line()], now);
  const current = { ...product, price: 150 };
  const result = restoreCart(raw, catalog([current]), now);
  assert.equal(result.lines[0].item.price, 150);
  assert.equal(result.lines[0].quantity, 2);
  assert.equal(result.lines[0].instructions, "less ice");
  assert.equal(result.changed, false);
  assert.equal(JSON.parse(raw).lines[0].price, undefined);
});

test("drops missing products, unavailable products, and removed options", () => {
  const variant = { id: "large", price: 160 };
  const withOptions = { ...product, variants: [variant] };
  for (const items of [
    [],
    [{ ...product, isAvailable: false }],
    [{ ...product, variants: [{ id: "small", price: 100 }] }],
  ]) {
    const result = restoreCart(
      encodeCart([line(withOptions, variant)], now),
      catalog(items),
      now,
    );
    assert.deepEqual(result.lines, []);
    assert.equal(result.changed, true);
  }
});

test("rejects expired or corrupted storage and isolates store keys", () => {
  assert.notEqual(cartStorageKey("1"), cartStorageKey("2"));
  for (const raw of [
    "{bad",
    "null",
    encodeCart([line()], now - CART_MAX_AGE - 1),
    encodeCart([line()], now + 1),
  ]) {
    assert.deepEqual(restoreCart(raw, catalog(), now).lines, []);
  }
  const raw = JSON.parse(encodeCart([line()], now));
  raw.lines.unshift(null, { ...raw.lines[0], quantity: -1 });
  const result = restoreCart(JSON.stringify(raw), catalog(), now);
  assert.equal(result.lines.length, 1);
  assert.equal(result.changed, true);
});

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test("checkout retries reuse the key after reload, then clear after success", () => {
  const storage = memoryStorage();
  const first = checkoutRequestKey("store-a", null, storage);
  assert.equal(checkoutRequestKey("store-a", null, storage), first);
  assert.notEqual(checkoutRequestKey("store-b", null, storage), first);
  clearCheckoutRequest("store-a", storage);
  assert.notEqual(checkoutRequestKey("store-a", null, storage), first);
});

test("checkout retains in-memory retry protection when storage is blocked", () => {
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    },
  };
  const first = checkoutRequestKey("store", null, blocked);
  assert.equal(checkoutRequestKey("store", first, blocked), first);
  assert.doesNotThrow(() => clearCheckoutRequest("store", blocked));
});
