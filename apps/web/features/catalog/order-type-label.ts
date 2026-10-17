import type { BusinessCategory, OrderType } from "@pasaorder/types";

export function orderTypeLabel(
  orderType: OrderType,
  businessCategory: BusinessCategory,
) {
  if (orderType === "DINE_IN") return "Dine in";
  if (orderType === "DELIVERY") return "Delivery";
  return ["FOOD_BEVERAGE", "BAKERY"].includes(businessCategory)
    ? "Takeaway"
    : "Pickup";
}
