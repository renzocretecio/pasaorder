import {
  analyzeChatConversation,
  clefAvailable,
} from "../modules/orders/clef.service.js";
import {
  chatInboxBucket,
  intentDecisionLog,
  routeChatDecision,
} from "../modules/orders/decision-router.js";

if (!clefAvailable()) {
  console.error(
    "Set CLOUDFLARE_AI_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN in apps/api/.env first.",
  );
  process.exitCode = 1;
} else {
  try {
    for (const [label, conversation] of [
      [
        "order",
        "Customer: Pa-order po ng dalawang cheeseburger, pickup mamayang 7pm. Cash po.",
      ],
      ["greeting", "Customer: Hi po!"],
      ["thanks", "Customer: Salamat po!"],
      [
        "follow-up order",
        "Customer: May cheeseburger kayo?\nCustomer: Sige po, dalawang cheeseburger at isang Coke, pickup.",
      ],
      [
        "order then thanks",
        "Customer: Pa-order po ng dalawang cheeseburger, pickup.\nCustomer: Salamat po!",
      ],
    ]) {
      const decision = await analyzeChatConversation(conversation);
      const route = routeChatDecision(decision);
      const { runnerUp, margin } = intentDecisionLog("synthetic", decision);
      console.log(
        `${label}: intent ${decision.intent.value} (${decision.intent.confidence.toFixed(2)}), runner-up ${runnerUp?.toFixed(2) ?? "unknown"}, margin ${margin?.toFixed(2) ?? "unknown"}, clarification ${(decision.needsClarificationProbability ?? 0).toFixed(2)}, human ${(decision.requiresHumanProbability ?? 0).toFixed(2)}, route ${route}, inbox ${chatInboxBucket(decision)}.`,
      );
    }
  } catch {
    console.error(
      "Clef-flash check failed. Verify the Account ID, API token value, Workers AI permissions, and quota.",
    );
    process.exitCode = 1;
  }
}
