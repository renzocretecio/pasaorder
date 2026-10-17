import type { QuantityUnit } from "@pasaorder/types";

export function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 3,
  }).format(quantity);
}

export function minimumQuantity(unit: QuantityUnit) {
  return unit === "KG" ? 0.01 : 1;
}

export function quantityStep(unit: QuantityUnit) {
  return unit === "KG" ? 0.1 : 1;
}

export function quantityLabel(quantity: number, unit: QuantityUnit) {
  return `${formatQuantity(quantity)}${unit === "KG" ? " kg" : ""}`;
}
