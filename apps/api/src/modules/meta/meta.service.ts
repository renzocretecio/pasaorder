import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

const GRAPH_BASE = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;

export function metaWebhookVerifyToken() {
  return env.META_WEBHOOK_VERIFY_TOKEN ?? env.META_VERIFY_TOKEN;
}

export function metaMessengerConfigured() {
  return Boolean(
    env.META_APP_ID &&
    env.META_APP_SECRET &&
    metaWebhookVerifyToken() &&
    env.META_TOKEN_ENCRYPTION_KEY &&
    env.META_REDIRECT_URI,
  );
}

function requireMetaConfig() {
  if (!metaMessengerConfigured())
    throw new Error("Meta Messenger is not configured");
  return {
    appId: env.META_APP_ID!,
    appSecret: env.META_APP_SECRET!,
    redirectUri: env.META_REDIRECT_URI!,
    encryptionKey: Buffer.from(env.META_TOKEN_ENCRYPTION_KEY!, "hex"),
  };
}

export function makeMetaLoginUrl(ownerId: string, storeId: string) {
  const { appId, redirectUri } = requireMetaConfig();
  const state = jwt.sign(
    {
      purpose: "meta-messenger-connect",
      storeId,
      nonce: randomBytes(18).toString("hex"),
    },
    env.JWT_SECRET,
    {
      subject: ownerId,
      issuer: "pasaorder",
      audience: "pasaorder-meta-oauth",
      expiresIn: "10m",
    },
  );
  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    "pages_show_list,pages_manage_metadata,pages_messaging",
  );
  url.searchParams.set("auth_type", "rerequest");
  return url.toString();
}

export function verifyMetaOAuthState(value: string) {
  const payload = jwt.verify(value, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "pasaorder",
    audience: "pasaorder-meta-oauth",
  });
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.storeId !== "string" ||
    payload.purpose !== "meta-messenger-connect"
  )
    throw new Error("Invalid Meta OAuth state");
  return { ownerId: payload.sub, storeId: payload.storeId };
}

async function graphJson<T>(url: URL, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(15000),
  });
  const body = (await response.json().catch(() => null)) as
    (T & { error?: { message?: string } }) | null;
  if (!response.ok || !body || body.error)
    throw new Error("Meta API request failed");
  return body as T;
}

export type MetaPageCandidate = {
  id: string;
  name: string;
  encryptedPageAccessToken: string;
};

export async function exchangeMetaCode(
  code: string,
): Promise<MetaPageCandidate[]> {
  const { appId, appSecret, redirectUri } = requireMetaConfig();
  const tokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
  tokenUrl.searchParams.set("client_id", appId);
  tokenUrl.searchParams.set("client_secret", appSecret);
  tokenUrl.searchParams.set("redirect_uri", redirectUri);
  tokenUrl.searchParams.set("code", code);
  const userToken = await graphJson<{ access_token: string }>(tokenUrl);

  const longTokenUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
  longTokenUrl.searchParams.set("grant_type", "fb_exchange_token");
  longTokenUrl.searchParams.set("client_id", appId);
  longTokenUrl.searchParams.set("client_secret", appSecret);
  longTokenUrl.searchParams.set("fb_exchange_token", userToken.access_token);
  const longToken = await graphJson<{ access_token: string }>(longTokenUrl);

  const pagesUrl = new URL(`${GRAPH_BASE}/me/accounts`);
  pagesUrl.searchParams.set("fields", "id,name,access_token");
  pagesUrl.searchParams.set("limit", "100");
  const result = await graphJson<{
    data: { id: string; name: string; access_token: string }[];
  }>(pagesUrl, {
    headers: { authorization: `Bearer ${longToken.access_token}` },
  });
  return result.data
    .filter((page) => page.id && page.name && page.access_token)
    .map((page) => ({
      id: page.id,
      name: page.name,
      encryptedPageAccessToken: encryptMetaToken(page.access_token),
    }));
}

export function encryptMetaToken(token: string) {
  const { encryptionKey } = requireMetaConfig();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptMetaToken(value: string) {
  const { encryptionKey } = requireMetaConfig();
  const [iv, tag, encrypted] = value
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !encrypted)
    throw new Error("Invalid encrypted Meta token");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}

export function hashMetaSession(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createMetaSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
) {
  if (!env.META_APP_SECRET || !signature?.startsWith("sha256=")) return false;
  const supplied = Buffer.from(signature.slice(7), "hex");
  const expected = createHmac("sha256", env.META_APP_SECRET)
    .update(rawBody)
    .digest();
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}

export async function subscribeMetaPage(pageId: string, token: string) {
  const url = new URL(
    `${GRAPH_BASE}/${encodeURIComponent(pageId)}/subscribed_apps`,
  );
  url.searchParams.set("subscribed_fields", "messages,messaging_postbacks");
  const result = await graphJson<{ success: boolean }>(url, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!result.success) throw new Error("Meta did not subscribe the Page");
}

export async function unsubscribeMetaPage(pageId: string, token: string) {
  const url = new URL(
    `${GRAPH_BASE}/${encodeURIComponent(pageId)}/subscribed_apps`,
  );
  await graphJson<{ success: boolean }>(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
}

export async function getMessengerCustomerName(
  senderId: string,
  token: string,
) {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(senderId)}`);
  url.searchParams.set("fields", "first_name,last_name");
  const profile = await graphJson<{
    first_name?: string;
    last_name?: string;
  }>(url, { headers: { authorization: `Bearer ${token}` } });
  return [profile.first_name, profile.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
    .trim()
    .slice(0, 120);
}

export async function sendMessengerText(
  pageId: string,
  recipientId: string,
  text: string,
  token: string,
) {
  const url = new URL(`${GRAPH_BASE}/${encodeURIComponent(pageId)}/messages`);
  await graphJson<{ recipient_id: string; message_id: string }>(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
      messaging_type: "RESPONSE",
    }),
  });
}
