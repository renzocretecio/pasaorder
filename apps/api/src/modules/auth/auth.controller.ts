import type { Request, Response } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errors.js";
import {
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser,
} from "./auth.service.js";
import {
  beginGoogleOAuth,
  completeGoogleOAuth,
  exchangeGoogleOAuthCode,
  finishGoogleOAuth,
  googleOAuthConfigured,
} from "./google-oauth.service.js";
import {
  createSocketToken,
  disconnectOwnerSockets,
} from "../../realtime/socket.js";
export async function registerUserHandler(req: Request, res: Response) {
  res.status(201).json(await registerUser(req.body));
}
export async function loginUserHandler(req: Request, res: Response) {
  res.json(await loginUser(req.body));
}
export async function getCurrentUserHandler(req: Request, res: Response) {
  res.json({ user: await getCurrentUser(req.auth!.userId) });
}

export async function logoutUserHandler(req: Request, res: Response) {
  await logoutUser(req.auth!.userId);
  disconnectOwnerSockets(req.auth!.userId);
  res.status(204).end();
}

export async function createSocketTokenHandler(req: Request, res: Response) {
  res.json({
    token: createSocketToken(req.auth!.userId, req.auth!.tokenVersion),
  });
}

export function googleOAuthStatusHandler(_req: Request, res: Response) {
  res
    .set("Cache-Control", "no-store")
    .json({ enabled: googleOAuthConfigured() });
}

export async function beginGoogleOAuthHandler(req: Request, res: Response) {
  const state = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(req.query.state);
  res.redirect(302, await beginGoogleOAuth(state));
}

function webOAuthCallback(state: string, outcome: string, code?: string) {
  const callback = new URL("/auth/google/callback", env.WEB_ORIGIN);
  callback.searchParams.set("state", state);
  callback.searchParams.set("outcome", outcome);
  if (code) callback.searchParams.set("code", code);
  return callback.toString();
}

export async function googleOAuthCallbackHandler(req: Request, res: Response) {
  res.set("Cache-Control", "no-store").set("Referrer-Policy", "no-referrer");
  const state = typeof req.query.state === "string" ? req.query.state : "";
  if (!/^[a-f0-9]{64}$/.test(state)) {
    res.redirect(302, webOAuthCallback("", "failed"));
    return;
  }

  try {
    const attempt = await finishGoogleOAuth(state);
    if (typeof req.query.error === "string") {
      res.redirect(302, webOAuthCallback(state, "cancelled"));
      return;
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code)
      throw new AppError(400, "Google did not return an authorization code.");
    const { handoffCode } = await completeGoogleOAuth(code, attempt);
    res.redirect(302, webOAuthCallback(state, "success", handoffCode));
  } catch (error) {
    const outcome =
      error instanceof AppError && error.status === 409
        ? "account_conflict"
        : "failed";
    console.error(
      "Google sign-in failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    res.redirect(302, webOAuthCallback(state, outcome));
  }
}

export async function exchangeGoogleOAuthCodeHandler(
  req: Request,
  res: Response,
) {
  const { code } = z
    .object({ code: z.string().min(40).max(128) })
    .parse(req.body);
  res
    .set("Cache-Control", "no-store")
    .json(await exchangeGoogleOAuthCode(code));
}
