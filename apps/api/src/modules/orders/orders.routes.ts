import { Router } from "express";
import { z } from "zod";
import {
  createOrderSchema,
  idSchema,
  updatePaymentStatusSchema,
  updateOrderStatusSchema,
  createChatOrderDraftSchema,
  updateChatOrderDraftSchema,
  confirmChatOrderDraftSchema,
  customerChatTokenSchema,
  sendCustomerChatMessageSchema,
  slugSchema,
  startCustomerChatSchema,
} from "@pasaorder/validation";
import { AppError } from "../../middleware/errors.js";
import { requireAuth } from "../../middleware/auth.js";
import * as repository from "./orders.repository.js";
import { emitOrdersChanged } from "../../realtime/socket.js";
import { analyzeChatConversation, clefAvailable } from "./clef.service.js";
import {
  canExtractOrderCandidate,
  intentDecisionLog,
  routeChatDecision,
} from "./decision-router.js";
import { readCatalog } from "../catalog/catalog.repository.js";
import { inquiryContext } from "./inquiry-context.js";
import {
  extractChatOrder,
  geminiAvailable,
  reviewExtraction,
} from "./gemini.service.js";

const router = Router();
export const ownerOrdersRouter = Router();
export const publicChatRouter = Router();

publicChatRouter.post("/stores/:slug", async (req, res) => {
  const slug = slugSchema.parse(req.params.slug);
  const { customerName } = startCustomerChatSchema.parse(req.body);
  res.status(201).json(await repository.startCustomerChat(slug, customerName));
});
publicChatRouter.get("/:token", async (req, res) => {
  const token = customerChatTokenSchema.parse(req.params.token);
  res.json({ chat: await repository.getCustomerChat(token) });
});
publicChatRouter.post("/:token/messages", async (req, res) => {
  const token = customerChatTokenSchema.parse(req.params.token);
  const { messageId, text } = sendCustomerChatMessageSchema.parse(req.body);
  const { messages, updated } = await repository.sendCustomerChatMessage(
    token,
    messageId,
    text,
  );
  res.json({ messages });
  if (updated && clefAvailable()) {
    // The customer response is already sent. A slow provider cannot delay chat.
    void (async () => {
      try {
        const decision = await analyzeChatConversation(
          updated.conversationText,
        );
        const saved = await repository.savePublicChatDecision(
          updated.id,
          updated.conversationText,
          decision,
        );
        if (saved) {
          console.info(JSON.stringify(intentDecisionLog(updated.id, decision)));
        }
      } catch {
        // Keep the chat usable if Clef or persistence fails.
        console.warn(
          JSON.stringify({
            event: "chat_intent_analysis_failed",
            draftId: updated.id,
          }),
        );
      }
    })();
  }
});

ownerOrdersRouter.use(requireAuth);
ownerOrdersRouter.get("/stores/:storeId/chat-drafts", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  res.json({
    analysisAvailable: clefAvailable(),
    drafts: await repository.listChatOrderDrafts(req.auth!.userId, storeId),
  });
});
ownerOrdersRouter.post("/stores/:storeId/chat-drafts", async (req, res) => {
  const storeId = idSchema.parse(req.params.storeId);
  const input = createChatOrderDraftSchema.parse(req.body);
  const draft = await repository.createChatOrderDraft(
    req.auth!.userId,
    storeId,
    input,
  );
  if (clefAvailable()) {
    try {
      const decision = await analyzeChatConversation(input.conversationText);
      await repository.saveChatDecision(
        req.auth!.userId,
        draft.id,
        input.conversationText,
        decision,
      );
      console.info(JSON.stringify(intentDecisionLog(draft.id, decision)));
      draft.decision = decision;
    } catch {
      // A provider error must not prevent an owner from working on a manual draft.
    }
  }
  res.status(201).json({ draft });
});
ownerOrdersRouter.get("/chat-drafts/:id", async (req, res) => {
  res.json({
    analysisAvailable: clefAvailable(),
    extractionAvailable: geminiAvailable(),
    draft: await repository.getChatOrderDraft(
      req.auth!.userId,
      idSchema.parse(req.params.id),
    ),
  });
});
ownerOrdersRouter.post("/chat-drafts/:id/prepare", async (req, res) => {
  const { force } = z
    .object({ force: z.boolean().optional() })
    .strict()
    .parse(req.body ?? {});
  const draft = await repository.getChatOrderDraft(
    req.auth!.userId,
    idSchema.parse(req.params.id),
  );
  if (draft.status !== "DRAFT")
    throw new AppError(409, "This order was already confirmed.");
  let decision = draft.decision;
  if (clefAvailable() && !decision) {
    try {
      decision = await analyzeChatConversation(draft.conversationText);
      await repository.saveChatDecision(
        req.auth!.userId,
        draft.id,
        draft.conversationText,
        decision,
      );
      console.info(JSON.stringify(intentDecisionLog(draft.id, decision)));
    } catch (error) {
      if (error instanceof AppError) throw error;
      decision = null;
    }
  }
  const route = routeChatDecision(decision, force);
  if (route !== "EXTRACT_ORDER" && !canExtractOrderCandidate(decision)) {
    const context =
      route === "REVIEW_PRODUCT" ||
      route === "REVIEW_STORE" ||
      route === "REVIEW_PAYMENT"
        ? inquiryContext(
            route,
            await readCatalog(draft.storeId, req.auth!.userId),
            draft.conversationText,
          )
        : null;
    await repository.assertChatDraftUnchanged(
      req.auth!.userId,
      draft.id,
      draft.conversationText,
    );
    res.json({
      skipped: true,
      route,
      decision,
      conversationText: draft.conversationText,
      context,
    });
    return;
  }
  if (!geminiAvailable())
    throw new AppError(503, "Order extraction is not available right now.");
  const catalog = await readCatalog(draft.storeId, req.auth!.userId);
  let extracted;
  try {
    extracted = await extractChatOrder(draft.conversationText, catalog);
  } catch {
    throw new AppError(
      503,
      "Couldn’t prepare this draft. Check your Gemini key or quota, then try again.",
    );
  }
  await repository.assertChatDraftUnchanged(
    req.auth!.userId,
    draft.id,
    draft.conversationText,
  );
  res.json({
    skipped: false,
    review: reviewExtraction(
      extracted,
      catalog,
      draft.draftData,
      draft.conversationText,
      decision,
    ),
  });
});
ownerOrdersRouter.patch("/chat-drafts/:id", async (req, res) => {
  await repository.updateChatOrderDraft(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    updateChatOrderDraftSchema.parse(req.body),
  );
  res.sendStatus(204);
});
ownerOrdersRouter.delete("/chat-drafts/:id", async (req, res) => {
  await repository.deleteChatOrderDraft(
    req.auth!.userId,
    idSchema.parse(req.params.id),
  );
  res.sendStatus(204);
});
ownerOrdersRouter.post("/chat-drafts/:id/confirm", async (req, res) => {
  const result = await repository.confirmChatOrderDraft(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    confirmChatOrderDraftSchema.parse(req.body),
  );
  emitOrdersChanged(result.storeId);
  res.status(201).json({ orderId: result.orderId });
});
ownerOrdersRouter.get("/", async (req, res) => {
  const storeId =
    req.query.storeId === undefined
      ? undefined
      : idSchema.parse(req.query.storeId);
  res.json({
    orders: await repository.listOwnerOrders(req.auth!.userId, storeId),
  });
});
ownerOrdersRouter.patch("/:id/status", async (req, res) => {
  const { storeId } = await repository.updateOwnerOrder(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    updateOrderStatusSchema.parse(req.body),
  );
  emitOrdersChanged(storeId);
  res.sendStatus(204);
});
ownerOrdersRouter.patch("/:id/payment", async (req, res) => {
  const { storeId } = await repository.updateOwnerOrderPayment(
    req.auth!.userId,
    idSchema.parse(req.params.id),
    updatePaymentStatusSchema.parse(req.body).status,
  );
  emitOrdersChanged(storeId);
  res.sendStatus(204);
});

router.post("/", async (req, res) => {
  const input = createOrderSchema.parse(req.body);
  const result = await repository.createPublicOrder(input);
  if (result.created) emitOrdersChanged(result.order.storeId);
  res.status(201).json({ order: result.order });
});

router.get("/:trackingToken", async (req, res) => {
  const token = req.params.trackingToken;
  if (!/^[0-9a-f-]{36}$/i.test(token))
    throw new AppError(404, "Order not found");
  res.json({ order: await repository.getPublicOrder(token) });
});

export default router;
