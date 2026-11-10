import { pool } from "../db.js";

const [email, rawPlan] = process.argv.slice(2);
const plan = rawPlan?.toUpperCase();

if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  (plan !== "FREE" && plan !== "PRO")
) {
  console.error(
    "Usage: pnpm --filter api exec tsx src/scripts/set-owner-plan.ts <email> <FREE|PRO>",
  );
  process.exitCode = 2;
} else {
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string; email: string }>(
        "UPDATE users SET plan = $2 WHERE LOWER(email) = LOWER($1) RETURNING id, email",
        [email, plan],
      );
      const user = result.rows[0];
      if (!user) throw new Error("No account found for that email.");
      if (plan === "PRO") {
        await client.query(
          `INSERT INTO owner_subscriptions
             (owner_id, status, period_start, period_end, grace_period_end)
           VALUES ($1, 'ACTIVE', NOW(), NOW() + interval '1 month', NULL)
           ON CONFLICT (owner_id) DO UPDATE SET
             status='ACTIVE', period_start=NOW(),
             period_end=NOW() + interval '1 month',
             grace_period_end=NULL, updated_at=NOW()`,
          [user.id],
        );
      } else {
        await client.query(
          `UPDATE owner_subscriptions SET status='EXPIRED',
             grace_period_end=NULL, updated_at=NOW() WHERE owner_id=$1`,
          [user.id],
        );
      }
      await client.query("COMMIT");
      console.log(`Updated ${user.email} to the ${plan} plan.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Could not update the account plan.", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
