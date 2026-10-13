import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import { emitChatsChanged } from "../../realtime/socket.js";
import {
  analyzeChatConversation,
  thinklessAvailable,
} from "../orders/thinkless.service.js";
import { intentDecisionLog } from "../orders/decision-router.js";
import * as repository from "./meta.repository.js";
import {
  createMetaSessionToken,
  decryptMetaToken,
  exchangeMetaCode,
  getInstagramCustomerName,
  getMessengerCustomerName,
  makeMetaLoginUrl,
  metaIntegrationConfigured,
  metaWebhookVerifyToken,
  sendInstagramText,
  sendMessengerText,
  subscribeMetaPage,
  unsubscribeMetaPage,
  verifyMetaOAuthState,
  verifyMetaWebhookSignature,
} from "./meta.service.js";

const router = Router();
const ownerRouter = Router();
const idSchema = z.string().regex(/^[1-9]\d*$/);
const tokenSchema = z.string().min(40).max(100);
const profileLookups = new Set<string>();

async function populateMetaCustomerName(
  draftId: string,
  channel: "MESSENGER" | "INSTAGRAM",
) {
  if (profileLookups.has(draftId)) return;
  profileLookups.add(draftId);
  try {
    const lookup = await repository.getMetaProfileLookup(draftId);
    if (!lookup) return;
    const token = decryptMetaToken(lookup.encryptedPageAccessToken);
    const name =
      channel === "INSTAGRAM"
        ? await getInstagramCustomerName(lookup.senderId, token)
        : await getMessengerCustomerName(lookup.senderId, token);
    if (name && (await repository.saveMetaCustomerName(draftId, name, channel)))
      emitChatsChanged(lookup.storeId);
  } finally {
    profileLookups.delete(draftId);
  }
}

router.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === metaWebhookVerifyToken() &&
    typeof req.query["hub.challenge"] === "string"
  ) {
    res.status(200).type("text/plain").send(req.query["hub.challenge"]);
    return;
  }
  res.sendStatus(403);
});

router.post("/webhook", async (req, res) => {
  const rawBody = (req as typeof req & { rawBody?: Buffer }).rawBody;
  if (
    !rawBody ||
    !verifyMetaWebhookSignature(rawBody, req.get("x-hub-signature-256"))
  ) {
    res.sendStatus(401);
    return;
  }
  const payload = z
    .object({
      object: z.string(),
      entry: z
        .array(
          z.object({
            id: z.string(),
            messaging: z.array(z.unknown()).optional(),
          }),
        )
        .optional(),
    })
    .safeParse(req.body);
  if (!payload.success) {
    res.sendStatus(400);
    return;
  }
  if (!["page", "instagram"].includes(payload.data.object)) {
    res.sendStatus(404);
    return;
  }
  const channel =
    payload.data.object === "instagram" ? "INSTAGRAM" : "MESSENGER";
  for (const entry of payload.data.entry ?? []) {
    for (const rawEvent of entry.messaging ?? []) {
      const event = z
        .object({
          sender: z.object({ id: z.string() }),
          recipient: z.object({ id: z.string() }).optional(),
          timestamp: z.number().optional(),
          message: z
            .object({
              mid: z.string().optional(),
              text: z.string().optional(),
              is_echo: z.boolean().optional(),
            })
            .optional(),
        })
        .safeParse(rawEvent);
      if (
        !event.success ||
        !event.data.message?.text?.trim() ||
        !event.data.message.mid ||
        event.data.message.is_echo ||
        event.data.sender.id === event.data.recipient?.id
      )
        continue;
      const saved = await repository.appendMetaMessage({
        channel,
        accountId: entry.id,
        senderId: event.data.sender.id,
        messageId: event.data.message.mid,
        text: event.data.message.text.trim().slice(0, 4000),
        createdAt: new Date(event.data.timestamp ?? Date.now()).toISOString(),
      });
      if (saved) emitChatsChanged(saved.storeId);
      if (saved) {
        void populateMetaCustomerName(saved.id, channel).catch(() => {
          console.info(
            JSON.stringify({
              event: `${channel.toLowerCase()}_customer_profile_unavailable`,
              draftId: saved.id,
            }),
          );
        });
      }
      if (saved && thinklessAvailable()) {
        void analyzeChatConversation(saved.conversationText, saved.id)
          .then(async (decision) => {
            const persisted = await repository.saveMetaChatDecision(
              saved.id,
              saved.conversationText,
              decision,
            );
            if (persisted)
              console.info(
                JSON.stringify(intentDecisionLog(saved.id, decision)),
              );
            if (persisted) emitChatsChanged(saved.storeId);
          })
          .catch(() => {
            console.warn(
              JSON.stringify({
                event: "messenger_intent_analysis_failed",
                draftId: saved.id,
              }),
            );
          });
      }
    }
  }
  res.sendStatus(200);
});

router.get("/oauth/callback", async (req, res) => {
  const state = typeof req.query.state === "string" ? req.query.state : "";
  let target: {
    ownerId: string;
    storeId: string;
    channel: "MESSENGER" | "INSTAGRAM";
  };
  try {
    target = verifyMetaOAuthState(state);
  } catch {
    res.redirect(`${env.WEB_ORIGIN}/dashboard?meta_error=invalid_state`);
    return;
  }
  const channelParam =
    target.channel === "INSTAGRAM" ? "instagram" : "messenger";
  const settings = `${env.WEB_ORIGIN}/dashboard/stores/${encodeURIComponent(target.storeId)}/settings`;
  if (req.query.error || typeof req.query.code !== "string") {
    res.redirect(`${settings}?${channelParam}_error=cancelled`);
    return;
  }
  try {
    await repository.assertStoreOwner(target.storeId, target.ownerId);
    const pages = await exchangeMetaCode(req.query.code, target.channel);
    if (!pages.length) {
      res.redirect(`${settings}?${channelParam}_error=no_pages`);
      return;
    }
    if (
      target.channel === "INSTAGRAM" &&
      !pages.some((page) => page.instagramId)
    ) {
      res.redirect(`${settings}?instagram_error=no_accounts`);
      return;
    }
    const sessionToken = createMetaSessionToken();
    await repository.saveMetaOAuthSession(
      sessionToken,
      target.storeId,
      target.ownerId,
      pages,
    );
    res.redirect(
      `${settings}?${channelParam}_session=${encodeURIComponent(sessionToken)}`,
    );
  } catch {
    res.redirect(`${settings}?${channelParam}_error=connect_failed`);
  }
});

ownerRouter.use(requireAuth);
ownerRouter.post("/stores/:storeId/connect", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  await repository.assertStoreOwner(storeId, req.auth!.userId);
  if (!metaIntegrationConfigured())
    throw new AppError(503, "Messenger connection is not configured yet.");
  res.json({ url: makeMetaLoginUrl(req.auth!.userId, storeId) });
});
ownerRouter.post("/stores/:storeId/instagram/connect", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  await repository.assertStoreOwner(storeId, req.auth!.userId);
  if (!metaIntegrationConfigured())
    throw new AppError(503, "Meta connection is not configured yet.");
  res.json({
    url: makeMetaLoginUrl(req.auth!.userId, storeId, "INSTAGRAM"),
  });
});
ownerRouter.get("/stores/:storeId", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  await repository.assertStoreOwner(storeId, req.auth!.userId);
  res.json({
    configured: metaIntegrationConfigured(),
    connection: await repository.getMetaPageConnection(
      storeId,
      req.auth!.userId,
    ),
    instagramConnection: await repository.getInstagramConnection(
      storeId,
      req.auth!.userId,
    ),
  });
});
ownerRouter.post("/chat-drafts/:draftId/replies", async (req, res) => {
  const draftId = idSchema.parse(req.params.draftId);
  const { text } = z
    .object({ text: z.string().trim().min(1).max(2000) })
    .strict()
    .parse(req.body);
  const context = await repository.getMetaReplyContext(
    req.auth!.userId,
    draftId,
    text.length,
  );
  if (context.channel === "INSTAGRAM" && text.length > 1000)
    throw new AppError(
      400,
      "Instagram replies are limited to 1,000 characters.",
    );
  try {
    const token = decryptMetaToken(context.encryptedPageAccessToken);
    if (context.channel === "INSTAGRAM") {
      await sendInstagramText(
        context.accountId,
        context.recipientId,
        text,
        token,
      );
    } else {
      await sendMessengerText(
        context.accountId,
        context.recipientId,
        text,
        token,
      );
    }
  } catch {
    throw new AppError(
      502,
      "Meta couldn’t send this reply. Check the Instagram/Messenger permission and whether the customer’s messaging window is still open.",
    );
  }
  const saved = await repository.appendMetaReply(
    req.auth!.userId,
    draftId,
    text,
  );
  emitChatsChanged(context.storeId);
  res.json(saved);
});
ownerRouter.get("/stores/:storeId/sessions/:token", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  const token = tokenSchema.parse(req.params.token);
  res.json({
    pages: await repository.listMetaOAuthPages(
      token,
      storeId,
      req.auth!.userId,
    ),
  });
});
ownerRouter.get(
  "/stores/:storeId/instagram/sessions/:token",
  async (req, res) => {
    const storeId = idSchema.parse(req.params.storeId);
    const token = tokenSchema.parse(req.params.token);
    const pages = await repository.listMetaOAuthPages(
      token,
      storeId,
      req.auth!.userId,
    );
    res.json({
      accounts: pages
        .filter((page) => page.instagramId)
        .map((page) => ({
          id: page.instagramId,
          username: page.instagramUsername || page.name,
          pageName: page.name,
        })),
    });
  },
);
ownerRouter.post(
  "/stores/:storeId/instagram/sessions/:token/select",
  async (req, res) => {
    const storeId = idSchema.parse(req.params.storeId);
    const token = tokenSchema.parse(req.params.token);
    const { instagramId } = z
      .object({ instagramId: z.string().regex(/^\d{1,64}$/) })
      .parse(req.body);
    const account = await repository.connectInstagramAccount(
      token,
      storeId,
      req.auth!.userId,
      instagramId,
    );
    try {
      await subscribeMetaPage(
        account.pageId,
        decryptMetaToken(account.encryptedPageAccessToken),
      );
    } catch {
      await repository.removeInstagramConnection(storeId, req.auth!.userId);
      throw new AppError(
        502,
        "Meta could not subscribe this Instagram account to messaging events.",
      );
    }
    res.sendStatus(204);
  },
);
ownerRouter.delete("/stores/:storeId/instagram", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  const connection = await repository.removeInstagramConnection(
    storeId,
    req.auth!.userId,
  );
  if (connection) {
    if (!(await repository.hasMetaPageConnection(storeId, connection.pageId))) {
      try {
        await unsubscribeMetaPage(
          connection.pageId,
          decryptMetaToken(connection.encryptedPageAccessToken),
        );
      } catch {
        // Local credentials are removed even if Meta has already revoked them.
      }
    }
  }
  res.sendStatus(204);
});
ownerRouter.post(
  "/stores/:storeId/sessions/:token/select",
  async (req, res) => {
    const storeId = idSchema.parse(req.params.storeId);
    const token = tokenSchema.parse(req.params.token);
    const { pageId } = z
      .object({ pageId: z.string().regex(/^\d{1,64}$/) })
      .parse(req.body);
    const page = await repository.connectMetaPage(
      token,
      storeId,
      req.auth!.userId,
      pageId,
    );
    try {
      await subscribeMetaPage(
        pageId,
        decryptMetaToken(page.encryptedPageAccessToken),
      );
    } catch {
      throw new AppError(
        502,
        "Meta could not subscribe this Page to Messenger events.",
      );
    }
    await repository.saveMetaPageConnection(
      token,
      storeId,
      req.auth!.userId,
      pageId,
    );
    res.sendStatus(204);
  },
);
ownerRouter.delete("/stores/:storeId", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  const connection = await repository.removeMetaPageConnection(
    storeId,
    req.auth!.userId,
  );
  if (
    connection &&
    !(await repository.hasMetaPageConnection(storeId, connection.pageId))
  ) {
    try {
      await unsubscribeMetaPage(
        connection.pageId,
        decryptMetaToken(connection.encryptedPageAccessToken),
      );
    } catch {
      // Local credentials are removed even if Meta has already revoked access.
    }
  }
  res.sendStatus(204);
});

export { ownerRouter as ownerMetaRouter };
export default router;
