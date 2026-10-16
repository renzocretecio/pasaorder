import webpush from "web-push";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool } from "../../db.js";

const pushEnabled = Boolean(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
);
if (pushEnabled) {
  webpush.setVapidDetails(
    env.VAPID_SUBJECT!,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );
}

export const pushSubscriptionSchema = z
  .object({
    endpoint: z.url().startsWith("https://").max(2048),
    keys: z
      .object({
        p256dh: z.string().min(1).max(256),
        auth: z.string().min(1).max(256),
      })
      .strict(),
  })
  .strict();
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export function publicPushKey() {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export async function saveOwnerSubscription(
  ownerId: string,
  subscription: PushSubscriptionInput,
) {
  await pool.query(
    `INSERT INTO owner_push_subscriptions (owner_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4) ON CONFLICT (endpoint) DO UPDATE SET owner_id = EXCLUDED.owner_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = now()`,
    [
      ownerId,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
    ],
  );
}

export async function removeOwnerSubscription(
  ownerId: string,
  endpoint: string,
) {
  await pool.query(
    `DELETE FROM owner_push_subscriptions WHERE owner_id = $1 AND endpoint = $2`,
    [ownerId, endpoint],
  );
}

export async function hasOwnerSubscription(ownerId: string, endpoint: string) {
  const result = await pool.query(
    `SELECT 1 FROM owner_push_subscriptions WHERE owner_id = $1 AND endpoint = $2`,
    [ownerId, endpoint],
  );
  return Boolean(result.rows[0]);
}

export async function saveCustomerSubscription(
  trackingToken: string,
  subscription: PushSubscriptionInput,
) {
  const order = await pool.query<{ id: string; status: string }>(
    `SELECT id, status FROM orders WHERE tracking_token = $1`,
    [trackingToken],
  );
  const savedOrder = order.rows[0];
  if (!savedOrder) return false;
  if (["READY", "COMPLETED", "CANCELLED"].includes(savedOrder.status))
    return false;
  await pool.query(
    `INSERT INTO customer_push_subscriptions (order_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4) ON CONFLICT (order_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, created_at = now()`,
    [
      savedOrder.id,
      subscription.endpoint,
      subscription.keys.p256dh,
      subscription.keys.auth,
    ],
  );
  return true;
}

export async function removeCustomerSubscription(
  trackingToken: string,
  endpoint: string,
) {
  await pool.query(
    `DELETE FROM customer_push_subscriptions cps USING orders o WHERE cps.order_id = o.id AND o.tracking_token = $1 AND cps.endpoint = $2`,
    [trackingToken, endpoint],
  );
}

export async function hasCustomerSubscription(
  trackingToken: string,
  endpoint: string,
) {
  const result = await pool.query(
    `SELECT 1 FROM customer_push_subscriptions cps JOIN orders o ON o.id = cps.order_id WHERE o.tracking_token = $1 AND cps.endpoint = $2`,
    [trackingToken, endpoint],
  );
  return Boolean(result.rows[0]);
}

type Notification = { title: string; body: string; url: string };
type SavedSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendToSubscriptions(
  table: "owner_push_subscriptions" | "customer_push_subscriptions",
  where: string,
  params: unknown[],
  notification: Notification,
) {
  if (!pushEnabled) return;
  const result = await pool.query<SavedSubscription>(
    `SELECT id, endpoint, p256dh, auth FROM ${table} WHERE ${where}`,
    params,
  );
  await Promise.all(
    result.rows.map(async (saved) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: saved.endpoint,
            keys: { p256dh: saved.p256dh, auth: saved.auth },
          },
          JSON.stringify(notification),
        );
      } catch (error) {
        const statusCode =
          error && typeof error === "object" && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        if (statusCode === 404 || statusCode === 410) {
          await pool.query(`DELETE FROM ${table} WHERE id = $1`, [saved.id]);
        } else {
          console.error("Web Push delivery failed", { statusCode });
        }
      }
    }),
  );
}

export async function notifyOwnerOfNewOrder(orderId: string, storeId: string) {
  try {
    const result = await pool.query<{ ownerId: string; storeName: string }>(
      `SELECT s.owner_id AS "ownerId", s.name AS "storeName" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = $1 AND o.store_id = $2`,
      [orderId, storeId],
    );
    const order = result.rows[0];
    if (!order) return;
    await sendToSubscriptions(
      "owner_push_subscriptions",
      "owner_id = $1",
      [order.ownerId],
      {
        title: "New order",
        body: `${order.storeName} · Order #${orderId}`,
        url: `/dashboard/stores/${storeId}/orders?queue=NEW&order=${orderId}`,
      },
    );
  } catch (error) {
    console.error("Could not send new-order notification", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

export async function notifyCustomerOrderReady(orderId: string) {
  try {
    const result = await pool.query<{
      trackingToken: string;
      storeName: string;
    }>(
      `SELECT o.tracking_token AS "trackingToken", s.name AS "storeName" FROM orders o JOIN stores s ON s.id = o.store_id WHERE o.id = $1`,
      [orderId],
    );
    const order = result.rows[0];
    if (!order) return;
    await sendToSubscriptions(
      "customer_push_subscriptions",
      "order_id = $1",
      [orderId],
      {
        title: "Your order is ready",
        body: `${order.storeName} · Order #${orderId}`,
        url: `/order/${order.trackingToken}`,
      },
    );
    await pool.query(
      `DELETE FROM customer_push_subscriptions WHERE order_id = $1`,
      [orderId],
    );
  } catch (error) {
    console.error("Could not send order-ready notification", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
}
