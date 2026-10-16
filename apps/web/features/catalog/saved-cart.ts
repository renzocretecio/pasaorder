import type {
  Catalog,
  Product,
  ProductVariant,
  SelectedProductAddon,
  StoreOrderAnswer,
} from "@pasaorder/types";

export type CartLine = {
  key: string;
  item: Product;
  variant: ProductVariant | null;
  addOns: SelectedProductAddon[];
  answers: StoreOrderAnswer[];
  quantity: number;
  instructions: string;
};

export const CART_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
export const cartStorageKey = (storeId: string) =>
  `pasaorder:cart:v1:${storeId}`;

export function encodeCart(lines: CartLine[], now = Date.now()) {
  return JSON.stringify({
    version: 1,
    savedAt: now,
    lines: lines.map((line) => ({
      productId: line.item.id,
      variantId: line.variant?.id ?? null,
      quantity: line.quantity,
      instructions: line.instructions,
      addOns: line.addOns,
      answers: line.answers,
    })),
  });
}

export function restoreCart(
  raw: string | null,
  catalog: Catalog,
  now = Date.now(),
): { lines: CartLine[]; changed: boolean } {
  const empty = { lines: [], changed: false };
  if (!raw) return empty;
  try {
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      !Number.isFinite(value.savedAt) ||
      value.savedAt > now ||
      now - value.savedAt > CART_MAX_AGE ||
      !Array.isArray(value.lines)
    )
      return empty;
    const products = new Map(
      catalog.categories.flatMap((category) =>
        category.items.map((item) => [item.id, item] as const),
      ),
    );
    const lines: CartLine[] = [];
    let changed = value.lines.length > 100;
    for (const saved of value.lines.slice(0, 100)) {
      const item = products.get(saved?.productId);
      const variant =
        item?.variants.find((option) => option.id === saved?.variantId) ?? null;
      if (
        !item?.isAvailable ||
        !Number.isInteger(saved.quantity) ||
        saved.quantity < 1 ||
        saved.quantity > 100 ||
        typeof saved.instructions !== "string" ||
        saved.instructions.length > 500 ||
        (item.variants.length ? !variant : saved.variantId !== null)
      ) {
        changed = true;
        continue;
      }
      const instructions = saved.instructions.trim();
      const addOns = Array.isArray(saved.addOns)
        ? saved.addOns.filter((choice: SelectedProductAddon) =>
            item.addOnGroups.some(
              (group) =>
                group.id === choice.groupId &&
                group.options.some((option) => option.id === choice.optionId),
            ),
          )
        : [];
      const answers = Array.isArray(saved.answers)
        ? saved.answers.flatMap((answer: StoreOrderAnswer) => {
            const question = item.orderQuestions?.find(
              (candidate) => candidate.id === answer?.questionId,
            );
            if (!question || typeof answer?.value !== "string") return [];
            const value = answer.value;
            const valid =
              question.type === "SELECT"
                ? question.options.includes(value)
                : question.type === "CHECKBOX"
                  ? value === "true" || value === "false"
                  : question.type === "NUMBER"
                    ? value.trim() !== "" && Number.isFinite(Number(value))
                    : question.type === "DATE"
                      ? /^\d{4}-\d{2}-\d{2}$/.test(value)
                      : question.type === "FILE"
                        ? false
                        : value.length <= 1000;
            return valid
              ? [{ questionId: question.id, label: question.label, value }]
              : [];
          })
        : [];
      if (
        Array.isArray(saved.answers) &&
        answers.length !== saved.answers.length
      )
        changed = true;
      const valid = new Set(
        addOns.map((choice: SelectedProductAddon) => choice.groupId),
      );
      if (
        item.addOnGroups.some((group) => group.required && !valid.has(group.id))
      ) {
        changed = true;
        continue;
      }
      const key = [
        item.id,
        variant?.id ?? "",
        instructions,
        ...addOns
          .map(
            (choice: SelectedProductAddon) =>
              `${choice.groupId}.${choice.optionId}`,
          )
          .sort(),
        ...answers
          .map(
            (answer: StoreOrderAnswer) =>
              `${answer.questionId}.${answer.value}`,
          )
          .sort(),
      ].join(":");
      if (lines.some((line) => line.key === key)) {
        changed = true;
        continue;
      }
      lines.push({
        key,
        item,
        variant,
        addOns,
        answers,
        quantity: saved.quantity,
        instructions,
      });
    }
    return { lines, changed };
  } catch {
    return empty;
  }
}

const requestStorageKey = (slug: string) =>
  `pasaorder:checkout-attempt:v1:${slug}`;

export function checkoutRequestKey(
  slug: string,
  fallback: string | null,
  storage: Storage | null,
): string {
  const key = requestStorageKey(slug);
  try {
    const saved = JSON.parse(storage?.getItem(key) ?? "null");
    if (
      typeof saved?.id === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        saved.id,
      ) &&
      Number.isFinite(saved.at) &&
      Date.now() - saved.at >= 0 &&
      Date.now() - saved.at < CART_MAX_AGE
    )
      return saved.id;
  } catch {
    /* Use the current tab when device storage is unavailable. */
  }
  const id = fallback ?? crypto.randomUUID();
  try {
    storage?.setItem(key, JSON.stringify({ id, at: Date.now() }));
  } catch {
    /* The in-memory key still protects retries in this tab. */
  }
  return id;
}

export function clearCheckoutRequest(slug: string, storage: Storage | null) {
  try {
    storage?.removeItem(requestStorageKey(slug));
  } catch {
    /* Storage may be disabled. */
  }
}

export function deviceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
