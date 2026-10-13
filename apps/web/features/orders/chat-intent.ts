import type { ChatRoute } from "@pasaorder/types";

export const chatRouteAdvice: Record<
  Exclude<ChatRoute, "EXTRACT_ORDER">,
  string
> = {
  REVIEW_MODIFICATION:
    "Check which order the customer means and its current status. Any change needs your review before updating the order.",
  REVIEW_CANCELLATION:
    "Verify the order and ask the customer to confirm the cancellation. No order has been cancelled.",
  REVIEW_STATUS:
    "Verify which order belongs to this customer before sharing its status. Chat identity alone is not enough.",
  REVIEW_PRODUCT:
    "Check the live catalog for availability, options, and prices before replying.",
  REVIEW_STORE:
    "Check this store’s current settings and schedule before replying.",
  REVIEW_PAYMENT:
    "Check this store’s enabled payment methods. Share only customer-facing payment instructions.",
  REVIEW_GREETING: "A simple greeting can be handled without order extraction.",
  REVIEW_OTHER:
    "This looks like an acknowledgement. Read the conversation and reply if needed.",
  REVIEW_UNCLEAR:
    "This chat needs your attention. Answer the customer's question or clarify the request before taking action.",
};
