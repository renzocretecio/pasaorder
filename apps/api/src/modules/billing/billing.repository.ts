import type { PoolClient } from "pg";
import type {
  OwnerBillingStatus,
  OwnerSubscriptionPaymentStatus,
  OwnerSubscriptionStatus,
  OwnerSubscriptionPaymentReview,
} from "@pasaorder/types";
import { pool } from "../../db.js";
import { AppError } from "../../middleware/errors.js";

export const PRO_MONTHLY_PRICE_MINOR = 29_900;

export async function syncOwnerSubscription(
  client: PoolClient,
  ownerId: string,
) {
  await client.query(
    `UPDATE owner_subscriptions
     SET status = 'PAST_DUE',
         grace_period_end = period_end + interval '7 days',
         updated_at = NOW()
     WHERE owner_id = $1 AND status = 'ACTIVE'
       AND period_end IS NOT NULL AND period_end <= NOW()`,
    [ownerId],
  );
  await client.query(
    `UPDATE owner_subscriptions
     SET status = 'EXPIRED', updated_at = NOW()
     WHERE owner_id = $1 AND status = 'PAST_DUE'
       AND grace_period_end IS NOT NULL AND grace_period_end <= NOW()`,
    [ownerId],
  );
  await client.query(
    `UPDATE users SET plan = 'FREE'
     WHERE id = $1 AND plan = 'PRO'
       AND EXISTS (
         SELECT 1 FROM owner_subscriptions s
         WHERE s.owner_id = users.id AND s.status = 'EXPIRED'
       )
       AND NOT EXISTS (
         SELECT 1 FROM owner_subscriptions s
         WHERE s.owner_id = users.id AND s.status IN ('ACTIVE', 'PAST_DUE')
           AND (s.status = 'ACTIVE' OR s.grace_period_end > NOW())
       )`,
    [ownerId],
  );
}

async function withOwnerTransaction<T>(
  ownerId: string,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await syncOwnerSubscription(client, ownerId);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBillingStatus(
  ownerId: string,
  config: { isBillingAdmin: boolean },
): Promise<OwnerBillingStatus> {
  return withOwnerTransaction(ownerId, async (client) => {
    const result = await client.query<{
      subscriptionStatus: OwnerSubscriptionStatus | null;
      periodStart: Date | null;
      periodEnd: Date | null;
      gracePeriodEnd: Date | null;
      paymentId: string | null;
      reference: string | null;
      amountMinor: number | null;
      paymentStatus: OwnerSubscriptionPaymentStatus | null;
      submittedAt: Date | null;
      rejectionReason: string | null;
    }>(
      `SELECT s.status AS "subscriptionStatus", s.period_start AS "periodStart",
        s.period_end AS "periodEnd", s.grace_period_end AS "gracePeriodEnd",
        p.id::text AS "paymentId", p.gcash_reference AS reference,
        p.amount_minor AS "amountMinor", p.status AS "paymentStatus",
        p.submitted_at AS "submittedAt", p.rejection_reason AS "rejectionReason"
      FROM users u
      LEFT JOIN owner_subscriptions s ON s.owner_id = u.id
      LEFT JOIN LATERAL (
        SELECT * FROM owner_subscription_payments
        WHERE owner_id = u.id ORDER BY submitted_at DESC, id DESC LIMIT 1
      ) p ON true
      WHERE u.id = $1`,
      [ownerId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "Account not found");
    return {
      isBillingAdmin: config.isBillingAdmin,
      monthlyPrice: PRO_MONTHLY_PRICE_MINOR / 100,
      subscription: row.subscriptionStatus
        ? {
            status: row.subscriptionStatus,
            periodStart: row.periodStart?.toISOString() ?? null,
            periodEnd: row.periodEnd?.toISOString() ?? null,
            gracePeriodEnd: row.gracePeriodEnd?.toISOString() ?? null,
          }
        : null,
      latestPayment: row.paymentId
        ? {
            id: row.paymentId,
            reference: row.reference!,
            amountMinor: row.amountMinor!,
            status: row.paymentStatus!,
            submittedAt: row.submittedAt!.toISOString(),
            rejectionReason: row.rejectionReason,
          }
        : null,
    };
  });
}

export async function submitPaymentRequest(ownerId: string, reference: string) {
  return withOwnerTransaction(ownerId, async (client) => {
    const account = await client.query<{ plan: string }>(
      "SELECT plan FROM users WHERE id = $1 FOR UPDATE",
      [ownerId],
    );
    if (!account.rows[0]) throw new AppError(404, "Account not found");

    await client.query(
      `INSERT INTO owner_subscriptions (owner_id, status)
       VALUES ($1, 'PENDING') ON CONFLICT (owner_id) DO NOTHING`,
      [ownerId],
    );
    const subscription = await client.query<{ status: string }>(
      "SELECT status FROM owner_subscriptions WHERE owner_id = $1 FOR UPDATE",
      [ownerId],
    );
    const latest = await client.query<{ status: string }>(
      "SELECT status FROM owner_subscription_payments WHERE owner_id = $1 ORDER BY submitted_at DESC, id DESC LIMIT 1",
      [ownerId],
    );
    if (latest.rows[0]?.status === "PENDING")
      throw new AppError(409, "A payment is already waiting for review.");

    if (["EXPIRED"].includes(subscription.rows[0].status))
      await client.query(
        "UPDATE owner_subscriptions SET status='PENDING', grace_period_end=NULL, updated_at=NOW() WHERE owner_id=$1",
        [ownerId],
      );

    const payment = await client.query<{ id: string; status: string }>(
      `INSERT INTO owner_subscription_payments
         (owner_id, gcash_reference, amount_minor, status)
       VALUES ($1, $2, $3, 'PENDING')
       RETURNING id::text AS id, status`,
      [ownerId, reference, PRO_MONTHLY_PRICE_MINOR],
    );
    return payment.rows[0];
  });
}

export async function listPendingPaymentReviews(): Promise<
  OwnerSubscriptionPaymentReview[]
> {
  return (
    await pool.query<OwnerSubscriptionPaymentReview>(
      `SELECT p.id::text AS id, u.name AS "ownerName", u.email AS "ownerEmail",
        p.gcash_reference AS reference, p.amount_minor AS "amountMinor",
        p.submitted_at AS "submittedAt", s.status AS "subscriptionStatus",
        s.period_end AS "periodEnd"
      FROM owner_subscription_payments p
      JOIN users u ON u.id = p.owner_id
      JOIN owner_subscriptions s ON s.owner_id = p.owner_id
      WHERE p.status = 'PENDING'
      ORDER BY p.submitted_at ASC, p.id ASC`,
    )
  ).rows.map((row) => ({
    ...row,
    submittedAt: new Date(row.submittedAt).toISOString(),
    periodEnd: row.periodEnd ? new Date(row.periodEnd).toISOString() : null,
  }));
}

export async function reviewPaymentRequest(input: {
  paymentId: string;
  reviewerId: string;
  decision: "APPROVE" | "REJECT";
  reason?: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const paymentResult = await client.query<{
      ownerId: string;
      status: string;
    }>(
      `SELECT owner_id AS "ownerId", status FROM owner_subscription_payments
       WHERE id = $1 FOR UPDATE`,
      [input.paymentId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) throw new AppError(404, "Payment request not found");
    if (payment.status !== "PENDING")
      throw new AppError(409, "This payment request was already reviewed.");

    const subscriptionResult = await client.query<{
      status: string;
      periodEnd: Date | null;
    }>(
      `SELECT status, period_end AS "periodEnd" FROM owner_subscriptions
       WHERE owner_id = $1 FOR UPDATE`,
      [payment.ownerId],
    );
    const subscription = subscriptionResult.rows[0];
    if (!subscription) throw new AppError(404, "Subscription not found");

    if (input.decision === "APPROVE") {
      await client.query(
        `UPDATE owner_subscriptions
         SET status='ACTIVE',
             period_start=CASE WHEN period_end > NOW() THEN period_end ELSE NOW() END,
             period_end=CASE WHEN period_end > NOW()
               THEN period_end + interval '1 month'
               ELSE NOW() + interval '1 month' END,
             grace_period_end=NULL, updated_at=NOW()
         WHERE owner_id=$1`,
        [payment.ownerId],
      );
      await client.query("UPDATE users SET plan='PRO' WHERE id=$1", [
        payment.ownerId,
      ]);
    }
    const paymentStatus =
      input.decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await client.query(
      `UPDATE owner_subscription_payments
       SET status=$2, reviewed_at=NOW(), reviewed_by=$3, rejection_reason=$4
       WHERE id=$1`,
      [
        input.paymentId,
        paymentStatus,
        input.reviewerId,
        input.decision === "REJECT" ? input.reason : null,
      ],
    );
    await client.query("COMMIT");
    return { status: paymentStatus };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
