import type { ChatDecision, ChatIntent, ChatRoute } from "@pasaorder/types";

// A decision selects a review lane; it never authorizes a mutation or disclosure.
const thresholds: Record<ChatIntent, number> = {
  CREATE_ORDER: 0.5,
  MODIFY_ORDER: 0.9,
  CANCEL_ORDER: 0.9,
  ORDER_STATUS: 0.9,
  PRODUCT_INQUIRY: 0.65,
  STORE_INQUIRY: 0.65,
  PAYMENT_INQUIRY: 0.9,
  GREETING: 0.7,
  OTHER: 0.7,
};
const LEGACY_THRESHOLD = 0.85;
const GENERAL_MARGIN = 0.2;
const SENSITIVE_MARGIN = 0.25;

export function normalizeChatIntent(
  value: ChatDecision["intent"]["value"],
): ChatIntent {
  if (value === "order_request") return "CREATE_ORDER";
  if (value === "question" || value === "other") return "OTHER";
  return value;
}

function scorePolicy(decision: ChatDecision) {
  const intent = normalizeChatIntent(decision.intent.value);
  const probabilities = decision.intent.probabilities;
  const runnerUp = probabilities
    ? Math.max(
        0,
        ...Object.entries(probabilities)
          .filter(([value]) => value !== intent)
          .map(([, probability]) => probability ?? 0),
      )
    : null;
  const sensitive = [
    "MODIFY_ORDER",
    "CANCEL_ORDER",
    "ORDER_STATUS",
    "PAYMENT_INQUIRY",
  ].includes(intent);
  return {
    threshold: runnerUp === null ? LEGACY_THRESHOLD : thresholds[intent],
    runnerUp,
    margin: runnerUp === null ? null : decision.intent.confidence - runnerUp,
    marginThreshold: sensitive ? SENSITIVE_MARGIN : GENERAL_MARGIN,
  };
}

export function routeChatDecision(
  decision: ChatDecision | null,
  force = false,
): ChatRoute {
  if (force || !decision) return "EXTRACT_ORDER";
  const intent = normalizeChatIntent(decision.intent.value);
  const policy = scorePolicy(decision);
  if (
    decision.intent.confidence < policy.threshold ||
    (policy.margin !== null && policy.margin < policy.marginThreshold)
  )
    return "REVIEW_UNCLEAR";
  switch (intent) {
    case "CREATE_ORDER":
      return "EXTRACT_ORDER";
    case "MODIFY_ORDER":
      return "REVIEW_MODIFICATION";
    case "CANCEL_ORDER":
      return "REVIEW_CANCELLATION";
    case "ORDER_STATUS":
      return "REVIEW_STATUS";
    case "PRODUCT_INQUIRY":
      return "REVIEW_PRODUCT";
    case "STORE_INQUIRY":
      return "REVIEW_STORE";
    case "PAYMENT_INQUIRY":
      return "REVIEW_PAYMENT";
    case "GREETING":
      return "REVIEW_GREETING";
    case "OTHER":
      return "REVIEW_OTHER";
  }
}

export function canExtractOrderCandidate(decision: ChatDecision | null) {
  if (
    !decision ||
    normalizeChatIntent(decision.intent.value) !== "CREATE_ORDER"
  )
    return false;
  // Intent selects the extraction path; Gemini and catalog matching decide
  // which individual items are safe to prefill.
  return true;
}

export function chatInboxBucket(decision: ChatDecision | null) {
  if (!decision) return "NEEDS_ATTENTION" as const;
  const route = routeChatDecision(decision);
  const clarification =
    decision.needsClarificationProbability ??
    decision.missingDetailsProbability ??
    1;
  const human = decision.requiresHumanProbability ?? 1;
  if (route === "EXTRACT_ORDER" && clarification < 0.7 && human < 0.7)
    return "POSSIBLE_ORDER" as const;
  if (route === "REVIEW_GREETING" && human < 0.4) return "NORMAL" as const;
  if (route === "REVIEW_OTHER" && clarification < 0.4 && human < 0.4)
    return "NORMAL" as const;
  return "NEEDS_ATTENTION" as const;
}

export function intentDecisionLog(draftId: string, decision: ChatDecision) {
  const policy = scorePolicy(decision);
  return {
    event: "chat_intent_routed",
    draftId,
    model: decision.model,
    intent: normalizeChatIntent(decision.intent.value),
    confidence: decision.intent.confidence,
    threshold: policy.threshold,
    runnerUp: policy.runnerUp,
    margin: policy.margin,
    marginThreshold: policy.marginThreshold,
    route: routeChatDecision(decision),
    needsClarification:
      (decision.needsClarificationProbability ??
        decision.missingDetailsProbability ??
        0) >= 0.7,
    requiresLLM: (decision.requiresLLMProbability ?? 0) >= 0.7,
    requiresHuman: (decision.requiresHumanProbability ?? 0) >= 0.7,
  };
}
