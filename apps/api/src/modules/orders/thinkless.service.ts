import { z } from "zod";
import type { ChatDecision } from "@pasaorder/types";
import { env } from "../../config/env.js";
import { pool } from "../../db.js";

const resultSchema = z.object({
  bucket: z.enum(["POSSIBLE_ORDER", "NEEDS_ATTENTION", "NORMAL"]),
  confidence: z.number().min(0).max(1),
  provider: z.string().min(1).max(100),
  status: z.enum(["accepted", "uncertain", "abstained"]),
});

export function thinklessAvailable() {
  return Boolean(env.INFERENCE_URL && env.INFERENCE_API_KEY);
}

export function conversationMessages(conversationText: string) {
  const messages: { role: "customer" | "store"; content: string }[] = [];
  for (const line of conversationText.split(/\r?\n/)) {
    const match = /^(Customer|Store):\s*(.*)$/i.exec(line);
    if (match) {
      const content = match[2].trim();
      if (content) {
        messages.push({
          role: match[1].toLowerCase() === "store" ? "store" : "customer",
          content,
        });
      }
    } else if (line.trim()) {
      const last = messages.at(-1);
      if (last) last.content = `${last.content}\n${line.trim()}`;
      else messages.push({ role: "customer", content: line.trim() });
    }
  }
  return messages.slice(-50).map((message) => ({
    ...message,
    content: message.content.slice(0, 4000),
  }));
}

async function hasActiveOrder(draftId: string) {
  const result = await pool.query<{ active: boolean }>(
    `SELECT EXISTS (
      SELECT 1 FROM chat_order_drafts current_draft
      JOIN chat_order_drafts prior ON prior.store_id = current_draft.store_id
        AND prior.provider_conversation_id = current_draft.provider_conversation_id
      JOIN orders o ON o.id = prior.order_id
      WHERE current_draft.id = $1
        AND current_draft.provider_conversation_id IS NOT NULL
        AND prior.id <> current_draft.id
        AND o.status IN ('NEW', 'CONFIRMED', 'PREPARING', 'READY')
    ) AS active`,
    [draftId],
  );
  return result.rows[0]?.active ?? false;
}

export async function analyzeChatConversation(
  conversationText: string,
  draftId: string,
): Promise<ChatDecision> {
  if (!thinklessAvailable()) throw new Error("ThinkLess is not configured");
  const messages = conversationMessages(conversationText);
  if (!messages.length) throw new Error("No conversation to classify");
  const response = await fetch(
    `${env.INFERENCE_URL!.replace(/\/$/, "")}/classify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": env.INFERENCE_API_KEY!,
      },
      body: JSON.stringify({
        messages,
        has_active_order: await hasActiveOrder(draftId),
      }),
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error("ThinkLess classification failed");
  const result = resultSchema.parse(await response.json());
  const bucket =
    result.status === "accepted" ? result.bucket : "NEEDS_ATTENTION";
  const confidence =
    bucket === "NEEDS_ATTENTION" && result.status !== "accepted"
      ? 0
      : result.confidence;
  return {
    model: "thinkless",
    policyVersion: 3,
    provider: result.provider,
    bucket,
    confidence,
    analyzedAt: new Date().toISOString(),
  };
}
