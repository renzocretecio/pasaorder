import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import {
  publicPushKey,
  pushSubscriptionSchema,
  hasCustomerSubscription,
  hasOwnerSubscription,
  removeCustomerSubscription,
  removeOwnerSubscription,
  saveCustomerSubscription,
  saveOwnerSubscription,
} from "./push.service.js";

const router = Router();
const endpointSchema = z
  .object({ endpoint: z.url().startsWith("https://").max(2048) })
  .strict();

router.get("/public-key", (_req, res) => {
  res.set("Cache-Control", "public, max-age=3600");
  res.json({ publicKey: publicPushKey() });
});

router.post("/owner/subscription", requireAuth, async (req, res) => {
  await saveOwnerSubscription(
    req.auth!.userId,
    pushSubscriptionSchema.parse(req.body),
  );
  res.sendStatus(204);
});
router.delete("/owner/subscription", requireAuth, async (req, res) => {
  const { endpoint } = endpointSchema.parse(req.body);
  await removeOwnerSubscription(req.auth!.userId, endpoint);
  res.sendStatus(204);
});
router.get("/owner/subscription", requireAuth, async (req, res) => {
  const { endpoint } = endpointSchema.parse(req.query);
  res.json({ enabled: await hasOwnerSubscription(req.auth!.userId, endpoint) });
});

router.post("/orders/:trackingToken/subscription", async (req, res) => {
  const trackingToken = z.uuid().parse(req.params.trackingToken);
  const saved = await saveCustomerSubscription(
    trackingToken,
    pushSubscriptionSchema.parse(req.body),
  );
  if (!saved) {
    res
      .status(409)
      .json({ message: "This order can no longer receive alerts" });
    return;
  }
  res.sendStatus(204);
});
router.delete("/orders/:trackingToken/subscription", async (req, res) => {
  const trackingToken = z.uuid().parse(req.params.trackingToken);
  const { endpoint } = endpointSchema.parse(req.body);
  await removeCustomerSubscription(trackingToken, endpoint);
  res.sendStatus(204);
});
router.get("/orders/:trackingToken/subscription", async (req, res) => {
  const trackingToken = z.uuid().parse(req.params.trackingToken);
  const { endpoint } = endpointSchema.parse(req.query);
  res.json({ enabled: await hasCustomerSubscription(trackingToken, endpoint) });
});

export default router;
