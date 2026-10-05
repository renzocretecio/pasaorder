import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { queryOne } from "../db.js";
import { AppError } from "./errors.js";
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; tokenVersion: number };
    }
  }
}
export const requireAuth: RequestHandler = async (req, _res, next) => {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    next(new AppError(401, "Authentication required"));
    return;
  }
  let payload: jwt.JwtPayload;
  try {
    const verified = jwt.verify(header.slice(7), env.JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "pasaorder",
      audience: "pasaorder-web",
    });
    if (
      typeof verified === "string" ||
      typeof verified.sub !== "string" ||
      !/^[1-9]\d*$/.test(verified.sub) ||
      !Number.isInteger(verified.version)
    )
      throw new Error("Invalid subject");
    payload = verified;
  } catch {
    next(new AppError(401, "Invalid or expired token"));
    return;
  }
  try {
    const user = await queryOne<{ tokenVersion: number }>(
      `SELECT token_version AS "tokenVersion" FROM users WHERE id = $1`,
      [payload.sub],
    );
    if (!user || user.tokenVersion !== payload.version) {
      next(new AppError(401, "Session expired. Please sign in again."));
      return;
    }
    req.auth = {
      userId: payload.sub!,
      tokenVersion: payload.version as number,
    };
    next();
  } catch (error) {
    next(error);
  }
};
export function signToken(userId: string, tokenVersion = 0) {
  return jwt.sign({ version: tokenVersion }, env.JWT_SECRET, {
    subject: userId,
    algorithm: "HS256",
    issuer: "pasaorder",
    audience: "pasaorder-web",
    expiresIn: "7d",
  });
}
