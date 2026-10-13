import type { ChatDecision, ChatRoute } from "@pasaorder/types";

const buckets = new Set<ChatDecision["bucket"]>([
  "POSSIBLE_ORDER",
  "NEEDS_ATTENTION",
  "NORMAL",
]);

// Old or malformed JSON in the decision column is left intact in PostgreSQL,
// but it is not trusted as a current classification. The owner can reclassify
// the draft when opening it, without a data migration.
export function currentChatDecision(value: unknown): ChatDecision | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.model !== "thinkless" ||
    candidate.policyVersion !== 3 ||
    typeof candidate.bucket !== "string" ||
    !buckets.has(candidate.bucket as ChatDecision["bucket"]) ||
    typeof candidate.provider !== "string" ||
    typeof candidate.confidence !== "number" ||
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1 ||
    typeof candidate.analyzedAt !== "string"
  )
    return null;
  return {
    model: "thinkless",
    policyVersion: 3,
    provider: candidate.provider,
    bucket: candidate.bucket as ChatDecision["bucket"],
    confidence: candidate.confidence,
    analyzedAt: candidate.analyzedAt,
  };
}

// A decision only chooses a review lane. It never mutates an order.
export function routeChatDecision(
  decision: ChatDecision | null,
  force = false,
): ChatRoute {
  if (force || !decision || decision.bucket === "POSSIBLE_ORDER")
    return "EXTRACT_ORDER";
  return decision.bucket === "NORMAL" ? "REVIEW_OTHER" : "REVIEW_UNCLEAR";
}

export function canExtractOrderCandidate(decision: ChatDecision | null) {
  return decision?.bucket === "POSSIBLE_ORDER";
}

export function chatInboxBucket(decision: ChatDecision | null) {
  return decision?.bucket ?? "NEEDS_ATTENTION";
}

export function intentDecisionLog(draftId: string, decision: ChatDecision) {
  return {
    event: "chat_intent_routed",
    draftId,
    model: decision.model,
    provider: decision.provider,
    bucket: decision.bucket,
    confidence: decision.confidence,
    threshold: 0.8,
    route: routeChatDecision(decision),
  };
}
