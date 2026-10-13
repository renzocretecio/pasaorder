import { createHash, createPublicKey, randomBytes } from "node:crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errors.js";
import { signToken } from "../../middleware/auth.js";
import {
  consumeGoogleOAuthCode,
  consumeGoogleOAuthState,
  createGoogleOAuthCode,
  findOrCreateGoogleUser,
  saveGoogleOAuthState,
} from "./auth.repository.js";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_CERTS_ENDPOINT = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_STATE_PATTERN = /^[a-f0-9]{64}$/;
const GOOGLE_CODE_PATTERN = /^[A-Za-z0-9_-]{40,128}$/;

type GoogleSigningKey = JsonWebKey & {
  kid?: string;
  alg?: string;
  use?: string;
};

let signingKeys: Map<string, ReturnType<typeof createPublicKey>> | undefined;
let signingKeysExpireAt = 0;
let signingKeysRequest: Promise<void> | undefined;

function requiredGoogleConfig() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI)
    throw new AppError(503, "Google sign-in is not configured.");
  return {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: GOOGLE_REDIRECT_URI,
  };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function googleOAuthConfigured() {
  return Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI,
  );
}

export async function beginGoogleOAuth(state: string) {
  if (!GOOGLE_STATE_PATTERN.test(state))
    throw new AppError(400, "Invalid Google sign-in request.");
  const config = requiredGoogleConfig();
  const nonce = randomBytes(32).toString("hex");
  const codeVerifier = randomBytes(48).toString("base64url");
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  await saveGoogleOAuthState(sha256(state), nonce, codeVerifier);

  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return authorizationUrl.toString();
}

async function refreshGoogleSigningKeys() {
  const response = await fetch(GOOGLE_CERTS_ENDPOINT, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Google signing keys unavailable");
  const result = (await response.json()) as { keys?: GoogleSigningKey[] };
  if (!Array.isArray(result.keys))
    throw new Error("Invalid Google signing keys");

  const keys = new Map<string, ReturnType<typeof createPublicKey>>();
  for (const key of result.keys) {
    if (key.kid && key.kty === "RSA" && key.alg === "RS256") {
      keys.set(key.kid, createPublicKey({ key, format: "jwk" }));
    }
  }
  if (!keys.size) throw new Error("No supported Google signing keys found");

  const maxAge = response.headers
    .get("cache-control")
    ?.match(/max-age=(\d+)/)?.[1];
  signingKeys = keys;
  signingKeysExpireAt =
    Date.now() + (maxAge ? Number(maxAge) * 1000 : 5 * 60_000);
}

async function getGoogleSigningKey(kid: string) {
  if (
    !signingKeys ||
    signingKeysExpireAt <= Date.now() ||
    !signingKeys.has(kid)
  ) {
    signingKeysRequest ??= refreshGoogleSigningKeys().finally(() => {
      signingKeysRequest = undefined;
    });
    await signingKeysRequest;
  }
  const key = signingKeys?.get(kid);
  if (!key) throw new Error("Unknown Google signing key");
  return key;
}

async function verifyGoogleIdToken(idToken: string, expectedNonce: string) {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || decoded.header.alg !== "RS256" || !decoded.header.kid)
    throw new Error("Invalid Google identity token");
  const config = requiredGoogleConfig();
  const key = await getGoogleSigningKey(decoded.header.kid);
  const payload = jwt.verify(idToken, key, {
    algorithms: ["RS256"],
    audience: config.clientId,
    issuer: ["accounts.google.com", "https://accounts.google.com"],
    clockTolerance: 5,
  }) as JwtPayload & {
    nonce?: string;
    email?: string;
    email_verified?: boolean;
    hd?: string;
    name?: string;
  };
  if (
    typeof payload.sub !== "string" ||
    payload.nonce !== expectedNonce ||
    typeof payload.email !== "string" ||
    payload.email_verified !== true
  ) {
    throw new Error("Google account did not provide a verified identity");
  }
  const email = payload.email.trim().toLowerCase();
  const name = payload.name?.trim() || email.split("@")[0] || "PasaOrder owner";
  return {
    sub: payload.sub,
    email,
    name,
    hostedDomain: payload.hd?.trim().toLowerCase(),
  };
}

export async function finishGoogleOAuth(state: string) {
  if (!GOOGLE_STATE_PATTERN.test(state))
    throw new AppError(400, "Invalid Google sign-in request.");
  const attempt = await consumeGoogleOAuthState(sha256(state));
  if (!attempt) throw new AppError(400, "Google sign-in session expired.");
  return attempt;
}

export async function completeGoogleOAuth(
  code: string,
  attempt: { nonce: string; codeVerifier: string },
) {
  const config = requiredGoogleConfig();
  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      code_verifier: attempt.codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    signal: AbortSignal.timeout(10000),
  });
  const tokenResult = (await tokenResponse.json().catch(() => null)) as {
    id_token?: string;
  } | null;
  if (!tokenResponse.ok || !tokenResult?.id_token)
    throw new AppError(401, "Google sign-in could not be verified.");

  const identity = await verifyGoogleIdToken(
    tokenResult.id_token,
    attempt.nonce,
  );
  let user;
  try {
    user = await findOrCreateGoogleUser(identity);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Google account conflict" ||
        error.message === "Google email cannot be safely linked")
    )
      throw new AppError(
        409,
        "This email already has a PasaOrder account. Sign in with your existing method.",
      );
    throw error;
  }

  const handoffCode = randomBytes(32).toString("base64url");
  await createGoogleOAuthCode(sha256(handoffCode), user.id);
  return { handoffCode };
}

export async function exchangeGoogleOAuthCode(code: string) {
  if (!GOOGLE_CODE_PATTERN.test(code))
    throw new AppError(400, "Invalid or expired Google sign-in session.");
  const user = await consumeGoogleOAuthCode(sha256(code));
  if (!user)
    throw new AppError(400, "Invalid or expired Google sign-in session.");
  return { token: signToken(user.id, user.tokenVersion) };
}
