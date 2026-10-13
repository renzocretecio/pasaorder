import { pool } from "../../db.js";
import { AppError } from "../../middleware/errors.js";
import { transaction } from "../catalog/catalog.repository.js";
import { hashMetaSession, type MetaPageCandidate } from "./meta.service.js";

export async function assertStoreOwner(storeId: string, ownerId: string) {
  const result = await pool.query(
    "SELECT id FROM stores WHERE id = $1 AND owner_id = $2",
    [storeId, ownerId],
  );
  if (!result.rows[0]) throw new AppError(404, "Store not found");
}

export async function saveMetaOAuthSession(
  token: string,
  storeId: string,
  ownerId: string,
  pages: MetaPageCandidate[],
) {
  await pool.query("DELETE FROM meta_oauth_sessions WHERE expires_at <= now()");
  await pool.query(
    `INSERT INTO meta_oauth_sessions (token_hash, store_id, owner_id, pages, expires_at) VALUES ($1, $2, $3, $4::jsonb, now() + interval '10 minutes')`,
    [hashMetaSession(token), storeId, ownerId, JSON.stringify(pages)],
  );
}

export async function listMetaOAuthPages(
  token: string,
  storeId: string,
  ownerId: string,
) {
  const result = await pool.query<{ pages: MetaPageCandidate[] }>(
    `SELECT session.pages FROM meta_oauth_sessions session JOIN stores ON stores.id = session.store_id WHERE session.token_hash = $1 AND session.store_id = $2 AND session.owner_id = $3 AND stores.owner_id = $3 AND session.expires_at > now()`,
    [hashMetaSession(token), storeId, ownerId],
  );
  if (!result.rows[0])
    throw new AppError(404, "This Meta connection has expired");
  return result.rows[0].pages.map(
    ({ id, name, instagramId, instagramUsername }) => ({
      id,
      name,
      instagramId,
      instagramUsername,
    }),
  );
}

export async function connectInstagramAccount(
  sessionToken: string,
  storeId: string,
  ownerId: string,
  instagramId: string,
) {
  return transaction(async (client) => {
    const selection = await client.query<{
      pageId: string;
      instagramUsername: string;
      encryptedPageAccessToken: string;
    }>(
      `SELECT candidate->>'id' AS "pageId", candidate->>'instagramUsername' AS "instagramUsername", candidate->>'encryptedPageAccessToken' AS "encryptedPageAccessToken" FROM meta_oauth_sessions session JOIN stores ON stores.id = session.store_id CROSS JOIN LATERAL jsonb_array_elements(session.pages) candidate WHERE session.token_hash = $1 AND session.store_id = $2 AND session.owner_id = $3 AND stores.owner_id = $3 AND session.expires_at > now() AND candidate->>'instagramId' = $4 FOR UPDATE OF session`,
      [hashMetaSession(sessionToken), storeId, ownerId, instagramId],
    );
    const account = selection.rows[0];
    if (!account)
      throw new AppError(
        404,
        "No Instagram professional account was found. Link it to a Facebook Page and try again.",
      );
    const existing = await client.query(
      "SELECT store_id FROM meta_instagram_connections WHERE instagram_id = $1 AND store_id <> $2",
      [instagramId, storeId],
    );
    if (existing.rows[0])
      throw new AppError(
        409,
        "This Instagram account is already connected to another store",
      );
    await client.query(
      `INSERT INTO meta_instagram_connections (store_id, instagram_id, instagram_username, page_id, encrypted_page_access_token) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (store_id) DO UPDATE SET instagram_id = EXCLUDED.instagram_id, instagram_username = EXCLUDED.instagram_username, page_id = EXCLUDED.page_id, encrypted_page_access_token = EXCLUDED.encrypted_page_access_token, updated_at = now()`,
      [
        storeId,
        instagramId,
        account.instagramUsername ?? "Instagram account",
        account.pageId,
        account.encryptedPageAccessToken,
      ],
    );
    await client.query(
      "DELETE FROM meta_oauth_sessions WHERE token_hash = $1",
      [hashMetaSession(sessionToken)],
    );
    return {
      instagramId,
      pageId: account.pageId,
      encryptedPageAccessToken: account.encryptedPageAccessToken,
    };
  });
}

export async function getInstagramConnection(storeId: string, ownerId: string) {
  const result = await pool.query<{
    instagramId: string;
    instagramUsername: string;
    connectedAt: Date;
  }>(
    `SELECT connection.instagram_id AS "instagramId", connection.instagram_username AS "instagramUsername", connection.created_at AS "connectedAt" FROM meta_instagram_connections connection JOIN stores ON stores.id = connection.store_id WHERE connection.store_id = $1 AND stores.owner_id = $2`,
    [storeId, ownerId],
  );
  const connection = result.rows[0];
  return connection
    ? { ...connection, connectedAt: connection.connectedAt.toISOString() }
    : null;
}

export async function removeInstagramConnection(
  storeId: string,
  ownerId: string,
) {
  const result = await pool.query<{
    instagramId: string;
    pageId: string;
    encryptedPageAccessToken: string;
  }>(
    `DELETE FROM meta_instagram_connections connection USING stores WHERE connection.store_id = stores.id AND connection.store_id = $1 AND stores.owner_id = $2 RETURNING connection.instagram_id AS "instagramId", connection.page_id AS "pageId", connection.encrypted_page_access_token AS "encryptedPageAccessToken"`,
    [storeId, ownerId],
  );
  return result.rows[0] ?? null;
}

export async function hasMetaPageConnection(storeId: string, pageId: string) {
  const result = await pool.query<{ connected: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM meta_page_connections WHERE store_id = $1 AND page_id = $2 UNION ALL SELECT 1 FROM meta_instagram_connections WHERE store_id = $1 AND page_id = $2) AS connected`,
    [storeId, pageId],
  );
  return result.rows[0]?.connected ?? false;
}

export async function connectMetaPage(
  sessionToken: string,
  storeId: string,
  ownerId: string,
  pageId: string,
) {
  const candidate = await pool.query<{
    name: string;
    encryptedPageAccessToken: string;
  }>(
    `SELECT candidate->>'name' AS name, candidate->>'encryptedPageAccessToken' AS "encryptedPageAccessToken" FROM meta_oauth_sessions session JOIN stores ON stores.id = session.store_id CROSS JOIN LATERAL jsonb_array_elements(session.pages) candidate WHERE session.token_hash = $1 AND session.store_id = $2 AND session.owner_id = $3 AND stores.owner_id = $3 AND session.expires_at > now() AND candidate->>'id' = $4`,
    [hashMetaSession(sessionToken), storeId, ownerId, pageId],
  );
  if (!candidate.rows[0]) throw new AppError(404, "Facebook Page not found");
  return { pageId, ...candidate.rows[0] };
}

export async function saveMetaPageConnection(
  sessionToken: string,
  storeId: string,
  ownerId: string,
  pageId: string,
) {
  await transaction(async (client) => {
    const selection = await client.query<{
      name: string;
      encryptedPageAccessToken: string;
    }>(
      `SELECT candidate->>'name' AS name, candidate->>'encryptedPageAccessToken' AS "encryptedPageAccessToken" FROM meta_oauth_sessions session JOIN stores ON stores.id = session.store_id CROSS JOIN LATERAL jsonb_array_elements(session.pages) candidate WHERE session.token_hash = $1 AND session.store_id = $2 AND session.owner_id = $3 AND stores.owner_id = $3 AND session.expires_at > now() AND candidate->>'id' = $4 FOR UPDATE OF session`,
      [hashMetaSession(sessionToken), storeId, ownerId, pageId],
    );
    const page = selection.rows[0];
    if (!page) throw new AppError(404, "Facebook Page not found");
    const existing = await client.query(
      "SELECT store_id FROM meta_page_connections WHERE page_id = $1 AND store_id <> $2",
      [pageId, storeId],
    );
    if (existing.rows[0])
      throw new AppError(
        409,
        "This Facebook Page is connected to another store",
      );
    await client.query(
      `INSERT INTO meta_page_connections (store_id, page_id, page_name, encrypted_page_access_token) VALUES ($1, $2, $3, $4) ON CONFLICT (store_id) DO UPDATE SET page_id = EXCLUDED.page_id, page_name = EXCLUDED.page_name, encrypted_page_access_token = EXCLUDED.encrypted_page_access_token, updated_at = now()`,
      [storeId, pageId, page.name, page.encryptedPageAccessToken],
    );
    await client.query(
      "DELETE FROM meta_oauth_sessions WHERE token_hash = $1",
      [hashMetaSession(sessionToken)],
    );
  });
}

export async function getMetaPageConnection(storeId: string, ownerId: string) {
  const result = await pool.query<{
    pageId: string;
    pageName: string;
    connectedAt: Date;
  }>(
    `SELECT connection.page_id AS "pageId", connection.page_name AS "pageName", connection.created_at AS "connectedAt" FROM meta_page_connections connection JOIN stores ON stores.id = connection.store_id WHERE connection.store_id = $1 AND stores.owner_id = $2`,
    [storeId, ownerId],
  );
  const connection = result.rows[0];
  return connection
    ? { ...connection, connectedAt: connection.connectedAt.toISOString() }
    : null;
}

export async function removeMetaPageConnection(
  storeId: string,
  ownerId: string,
) {
  const result = await pool.query<{
    pageId: string;
    encryptedPageAccessToken: string;
  }>(
    `DELETE FROM meta_page_connections connection USING stores WHERE connection.store_id = stores.id AND connection.store_id = $1 AND stores.owner_id = $2 RETURNING connection.page_id AS "pageId", connection.encrypted_page_access_token AS "encryptedPageAccessToken"`,
    [storeId, ownerId],
  );
  return result.rows[0] ?? null;
}

export async function appendMetaMessage(input: {
  channel: "MESSENGER" | "INSTAGRAM";
  accountId: string;
  senderId: string;
  messageId: string;
  text: string;
  createdAt: string;
}) {
  const result = await pool.query<{
    id: string;
    storeId: string;
    conversationText: string;
    chatMessages: { id: string; text: string; createdAt: string }[];
  }>(
    `INSERT INTO chat_order_drafts (store_id, source, conversation_text, draft_data, chat_messages, provider_conversation_id) SELECT connection.store_id, $6, 'Customer: ' || $4, jsonb_build_object('customerName', $7), jsonb_build_array(jsonb_build_object('id', $3::text, 'text', $4::text, 'createdAt', $5::text)), $2 FROM (SELECT store_id FROM meta_page_connections WHERE page_id = $1 AND $6 = 'MESSENGER' UNION ALL SELECT store_id FROM meta_instagram_connections WHERE instagram_id = $1 AND $6 = 'INSTAGRAM') connection ON CONFLICT (store_id, provider_conversation_id) WHERE provider_conversation_id IS NOT NULL AND status = 'DRAFT' DO UPDATE SET chat_messages = chat_order_drafts.chat_messages || EXCLUDED.chat_messages, conversation_text = CASE WHEN chat_order_drafts.conversation_text = '' THEN 'Customer: ' || $4::text ELSE chat_order_drafts.conversation_text || E'\\nCustomer: ' || $4::text END, decision = NULL, updated_at = now() WHERE NOT chat_order_drafts.chat_messages @> jsonb_build_array(jsonb_build_object('id', $3::text)) AND jsonb_array_length(chat_order_drafts.chat_messages) < 50 AND length(chat_order_drafts.conversation_text) + length($4::text) + 11 <= 15000 RETURNING id, store_id AS "storeId", conversation_text AS "conversationText", chat_messages AS "chatMessages"`,
    [
      input.accountId,
      input.senderId,
      input.messageId,
      input.text,
      input.createdAt,
      input.channel,
      input.channel === "INSTAGRAM"
        ? "Instagram customer"
        : "Messenger customer",
    ],
  );
  return result.rows[0] ?? null;
}

export async function getMetaProfileLookup(draftId: string) {
  const result = await pool.query<{
    storeId: string;
    senderId: string;
    encryptedPageAccessToken: string;
    channel: "MESSENGER" | "INSTAGRAM";
  }>(
    `SELECT d.store_id AS "storeId", d.provider_conversation_id AS "senderId", d.source AS channel, COALESCE(page.encrypted_page_access_token, instagram.encrypted_page_access_token) AS "encryptedPageAccessToken" FROM chat_order_drafts d LEFT JOIN meta_page_connections page ON page.store_id = d.store_id AND d.source = 'MESSENGER' LEFT JOIN meta_instagram_connections instagram ON instagram.store_id = d.store_id AND d.source = 'INSTAGRAM' WHERE d.id = $1 AND d.source IN ('MESSENGER', 'INSTAGRAM') AND d.status = 'DRAFT' AND COALESCE(NULLIF(d.draft_data->>'customerName', ''), CASE WHEN d.source = 'INSTAGRAM' THEN 'Instagram customer' ELSE 'Messenger customer' END) = CASE WHEN d.source = 'INSTAGRAM' THEN 'Instagram customer' ELSE 'Messenger customer' END AND COALESCE(page.store_id, instagram.store_id) IS NOT NULL`,
    [draftId],
  );
  return result.rows[0] ?? null;
}

export async function saveMetaCustomerName(
  draftId: string,
  customerName: string,
  channel: "MESSENGER" | "INSTAGRAM",
) {
  const result = await pool.query(
    `UPDATE chat_order_drafts d SET draft_data = jsonb_set(COALESCE(d.draft_data, '{}'::jsonb), '{customerName}', to_jsonb($2::text), true), updated_at = now() WHERE d.id = $1 AND d.source = $3 AND d.status = 'DRAFT' AND COALESCE(NULLIF(d.draft_data->>'customerName', ''), CASE WHEN d.source = 'INSTAGRAM' THEN 'Instagram customer' ELSE 'Messenger customer' END) = CASE WHEN d.source = 'INSTAGRAM' THEN 'Instagram customer' ELSE 'Messenger customer' END RETURNING d.id`,
    [draftId, customerName, channel],
  );
  return Boolean(result.rows[0]);
}

export async function getMetaReplyContext(
  ownerId: string,
  draftId: string,
  textLength: number,
) {
  const result = await pool.query<{
    storeId: string;
    accountId: string;
    channel: "MESSENGER" | "INSTAGRAM";
    recipientId: string;
    encryptedPageAccessToken: string;
  }>(
    `SELECT d.store_id AS "storeId", d.source AS channel, COALESCE(page.page_id, instagram.page_id) AS "accountId", d.provider_conversation_id AS "recipientId", COALESCE(page.encrypted_page_access_token, instagram.encrypted_page_access_token) AS "encryptedPageAccessToken" FROM chat_order_drafts d JOIN stores s ON s.id = d.store_id LEFT JOIN meta_page_connections page ON page.store_id = d.store_id AND d.source = 'MESSENGER' LEFT JOIN meta_instagram_connections instagram ON instagram.store_id = d.store_id AND d.source = 'INSTAGRAM' WHERE s.owner_id = $1 AND d.id = $2 AND d.source IN ('MESSENGER', 'INSTAGRAM') AND d.status = 'DRAFT' AND jsonb_array_length(d.chat_messages) < 50 AND length(d.conversation_text) + $3 + 9 <= 15000`,
    [ownerId, draftId, textLength],
  );
  if (!result.rows[0])
    throw new AppError(
      409,
      "This Meta conversation is unavailable or has reached its message limit.",
    );
  return result.rows[0];
}

export async function appendMetaReply(
  ownerId: string,
  draftId: string,
  text: string,
) {
  const result = await pool.query<{ conversationText: string }>(
    `UPDATE chat_order_drafts d SET chat_messages = d.chat_messages || jsonb_build_array(jsonb_build_object('id', gen_random_uuid()::text, 'text', $3::text, 'createdAt', $4::text, 'sender', 'STORE')), conversation_text = CASE WHEN d.conversation_text = '' THEN 'Store: ' || $3::text ELSE d.conversation_text || E'\\nStore: ' || $3::text END, updated_at = now() FROM stores s WHERE d.store_id = s.id AND s.owner_id = $1 AND d.id = $2 AND d.source IN ('MESSENGER', 'INSTAGRAM') AND d.status = 'DRAFT' AND jsonb_array_length(d.chat_messages) < 50 AND length(d.conversation_text) + length($3::text) + 9 <= 15000 RETURNING d.conversation_text AS "conversationText"`,
    [ownerId, draftId, text, new Date().toISOString()],
  );
  if (!result.rows[0])
    throw new AppError(409, "This conversation is no longer active.");
  return result.rows[0];
}

export async function saveMetaChatDecision(
  draftId: string,
  expectedConversation: string,
  decision: unknown,
) {
  const result = await pool.query(
    `UPDATE chat_order_drafts SET decision = $3::jsonb, updated_at = now() WHERE id = $1 AND source IN ('MESSENGER', 'INSTAGRAM') AND status = 'DRAFT' AND conversation_text = $2 RETURNING id`,
    [draftId, expectedConversation, JSON.stringify(decision)],
  );
  return Boolean(result.rows[0]);
}
