import type { Catalog } from "@pasaorder/types";
import {
  extractChatOrder,
  geminiAvailable,
  reviewExtraction,
} from "../modules/orders/gemini.service.js";

if (!geminiAvailable()) {
  console.error("Set GEMINI_API_KEY in apps/api/.env first.");
  process.exitCode = 1;
} else {
  const catalog = {
    store: { orderTypes: ["PICKUP"], paymentMethods: ["CASH"] },
    categories: [
      {
        items: [
          {
            id: "1",
            name: "Cheeseburger",
            isAvailable: true,
            variants: [],
          },
          { id: "2", name: "Coke", isAvailable: true, variants: [] },
        ],
      },
    ],
  } as unknown as Catalog;
  const conversationText =
    "Customer: Pa-order po ng dalawang cheeseburger, pickup. Maybe a Coke later.";
  try {
    const extracted = await extractChatOrder(conversationText, catalog);
    const review = reviewExtraction(
      extracted,
      catalog,
      { customerName: "Test customer" },
      conversationText,
      null,
    );
    if (
      !review.suggested.items?.some(
        (item) => item.productId === "1" && item.quantity === 2,
      ) ||
      review.suggested.items.some((item) => item.productId === "2")
    ) {
      throw new Error("Synthetic order did not match expected safe items");
    }
    console.log(
      `Gemini connected. Safe items: ${review.suggested.items.length}; not added: ${review.unmatchedItems.length}.`,
    );
  } catch {
    console.error(
      "Gemini check failed. Verify the key, model access, quota, and structured-output support.",
    );
    process.exitCode = 1;
  }
}
