import type { Catalog, ChatReviewContext, ChatRoute } from "@pasaorder/types";

function normalize(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function latestCustomerMessage(conversationText: string) {
  const customerLines = conversationText
    .split("\n")
    .filter((line) => /^customer\s*:/i.test(line));
  return customerLines.at(-1) ?? conversationText;
}

export function inquiryContext(
  route: ChatRoute,
  catalog: Catalog,
  conversationText: string,
): ChatReviewContext | null {
  if (route === "REVIEW_PRODUCT") {
    const message = normalize(latestCustomerMessage(conversationText));
    const matching = catalog.categories
      .flatMap((category) => category.items)
      .filter((item) => message.includes(normalize(item.name)))
      .slice(0, 5);
    return {
      title: "Catalog facts",
      facts: matching.length
        ? matching.map((item) => {
            const prices = item.variants.length
              ? item.variants
                  .map((variant) => `${variant.label}: ₱${variant.price}`)
                  .join(" · ")
              : `₱${item.price}`;
            return `${item.name} — ${item.isAvailable ? "Available" : "Unavailable"} · ${prices}`;
          })
        : [
            "No exact product name was found in the latest customer message. Check the catalog before answering.",
          ],
    };
  }
  if (route === "REVIEW_STORE") {
    const today = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "Asia/Manila",
    })
      .format(new Date())
      .toLowerCase();
    const hours = catalog.store.operatingHours?.find(
      (entry) => entry.day === today,
    );
    return {
      title: "Store facts",
      facts: [
        catalog.store.address
          ? `Address: ${catalog.store.address}`
          : "Address not configured",
        catalog.store.contactPhone
          ? `Contact: ${catalog.store.contactPhone}`
          : "Contact number not configured",
        `Available order types: ${catalog.store.orderTypes.join(", ")}`,
        hours
          ? `Today (${today}): ${hours.open ? `${hours.opens}–${hours.closes}` : "Closed"}`
          : "Today's hours are not configured",
      ],
    };
  }
  if (route === "REVIEW_PAYMENT") {
    return {
      title: "Payment facts",
      facts: [
        `Accepted methods: ${catalog.store.paymentMethods.join(", ")}`,
        ...(catalog.store.paymentMethods.includes("GCASH")
          ? [
              `GCash account: ${catalog.store.gcashAccountName ?? "Not configured"}`,
              `GCash number: ${catalog.store.gcashNumber ?? "Not configured"}`,
            ]
          : []),
      ],
    };
  }
  return null;
}
