import type { RequestHandler } from "express";
export function createAuthRateLimit(
  limit = 20,
  windowMs = 15 * 60 * 1000,
): RequestHandler {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, bucket] of attempts)
      if (bucket.resetAt <= now) attempts.delete(key);
    // Scope attempts by account as well as peer: browser requests arrive via Next.js.
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "unknown";
    const key = `${req.ip ?? "unknown"}:${email.slice(0, 255)}`;
    const bucket = attempts.get(key) ?? { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    attempts.set(key, bucket);
    if (bucket.count > limit) {
      res.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({
        message: "Too many sign-in attempts. Please try again later.",
      });
      return;
    }
    next();
  };
}
export const authRateLimit = createAuthRateLimit();
