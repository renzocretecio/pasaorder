import { Router } from "express";
import {
  idSchema,
  subscriptionPaymentRequestSchema,
  subscriptionPaymentReviewSchema,
} from "@pasaorder/validation";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../middleware/errors.js";
import { env } from "../../config/env.js";
import { pool } from "../../db.js";
import * as repository from "./billing.repository.js";

const router = Router();
router.use(requireAuth);

function adminEmails() {
  return new Set(
    (env.SUBSCRIPTION_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function requireBillingAdmin(userId: string) {
  const result = await pool.query<{ email: string }>(
    "SELECT email FROM users WHERE id=$1",
    [userId],
  );
  const email = result.rows[0]?.email?.toLowerCase();
  if (!email || !adminEmails().has(email))
    throw new AppError(403, "Billing administrator access is required");
}

router.get("/status", async (req, res) => {
  const emailResult = await pool.query<{ email: string }>(
    "SELECT email FROM users WHERE id=$1",
    [req.auth!.userId],
  );
  const email = emailResult.rows[0]?.email?.toLowerCase();
  res.json(
    await repository.getBillingStatus(req.auth!.userId, {
      isBillingAdmin: Boolean(email && adminEmails().has(email)),
    }),
  );
});

router.post("/requests", async (req, res) => {
  const input = subscriptionPaymentRequestSchema.parse(req.body);
  res
    .status(201)
    .json(
      await repository.submitPaymentRequest(req.auth!.userId, input.reference),
    );
});

router.get("/admin/requests", async (req, res) => {
  await requireBillingAdmin(req.auth!.userId);
  res.json({ requests: await repository.listPendingPaymentReviews() });
});

router.post("/admin/requests/:paymentId/review", async (req, res) => {
  await requireBillingAdmin(req.auth!.userId);
  const paymentId = idSchema.parse(req.params.paymentId);
  const decision = subscriptionPaymentReviewSchema.parse(req.body);
  res.json(
    await repository.reviewPaymentRequest({
      paymentId,
      reviewerId: req.auth!.userId,
      ...decision,
    }),
  );
});

export default router;
