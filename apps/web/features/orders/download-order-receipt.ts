import type { OwnerOrder } from "@pasaorder/types";

export type CustomerReceiptOrder = {
  id: string;
  status: string;
  orderType: "DINE_IN" | "PICKUP" | "DELIVERY";
  paymentMethod: "CASH" | "GCASH";
  paymentStatus: "UNPAID" | "PAID";
  itemsSubtotal: string;
  total: string;
  deliveryFee: string | null;
  createdAt: string;
  scheduledFor: string | null;
  tableNumber: string | null;
  formAnswers: { label: string; value: string }[];
  items: {
    productName: string;
    optionLabel: string | null;
    quantityUnit: "EACH" | "KG";
    quantity: number;
    subtotal: string;
    addOns: { groupName: string; optionName: string; price: string }[];
    productAnswers: { label: string; value: string }[];
  }[];
};

type ReceiptLine = {
  label?: string;
  value?: string;
  text?: string;
  kind?: "title" | "subtitle" | "section" | "muted" | "total" | "body";
};

function formatMoney(value: string) {
  const amount = Number(value);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(Number.isFinite(amount) ? amount : 0);
}

function wrap(text: string, maxChars = 66) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (word.length > maxChars) {
      if (line) lines.push(line);
      for (let offset = 0; offset < word.length; offset += maxChars) {
        lines.push(word.slice(offset, offset + maxChars));
      }
      line = "";
      continue;
    }
    if (line && `${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function receiptLines(storeName: string, order: OwnerOrder) {
  const placedAt = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(order.createdAt));
  const lines: ReceiptLine[] = [
    { text: storeName, kind: "title" },
    { text: "PASAORDER  ·  ORDER RECEIPT", kind: "subtitle" },
    { text: `Order #${order.id}  ·  ${placedAt} (Philippine time)`, kind: "body" },
    { text: "ORDER DETAILS", kind: "section" },
    { label: "Customer", value: order.customerName },
  ];

  if (order.customerPhone) {
    lines.push({ label: "Contact", value: order.customerPhone });
  }
  lines.push({
    label: "Order type",
    value: order.orderType.replaceAll("_", " "),
  });
  if (order.tableNumber) lines.push({ label: "Table", value: order.tableNumber });
  if (order.deliveryAddress) {
    lines.push({ label: "Delivery address", value: order.deliveryAddress });
  }
  if (order.scheduledFor) {
    lines.push({
      label: "Requested for",
      value: new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(order.scheduledFor)),
    });
  }
  lines.push(
    { label: "Status", value: order.status },
    {
      label: "Payment",
      value: `${order.paymentMethod} · ${
        order.paymentStatus === "PAID" ? "Paid (verified by store)" : "Unpaid / not verified"
      }`,
    },
    { text: "ITEMS", kind: "section" },
  );

  for (const item of order.items) {
    const quantity = new Intl.NumberFormat("en-PH", {
      maximumFractionDigits: 3,
    }).format(item.quantity);
    const unit = item.quantityUnit === "KG" ? " kg" : "";
    const option = item.optionLabel ? ` · ${item.optionLabel}` : "";
    lines.push({
      label: `${quantity}${unit} × ${item.productName}${option}`,
      value: formatMoney(item.subtotal),
    });
    for (const addon of item.addOns) {
      lines.push({
        text: `   + ${addon.groupName}: ${addon.optionName} (${formatMoney(addon.price)})`,
        kind: "muted",
      });
    }
    for (const answer of item.productAnswers) {
      lines.push({
        text: `   ${answer.label}: ${answer.value}`,
        kind: "muted",
      });
    }
    if (item.specialInstructions) {
      lines.push({
        text: `   Instruction: ${item.specialInstructions}`,
        kind: "muted",
      });
    }
  }

  const subtotal = Number(order.total) - Number(order.deliveryFee ?? 0);
  lines.push({ label: "Subtotal", value: formatMoney(String(subtotal)) });
  if (order.orderType === "DELIVERY") {
    lines.push({
      label: "Delivery fee",
      value:
        order.deliveryFee === null
          ? "To be confirmed"
          : formatMoney(order.deliveryFee),
    });
  }
  lines.push({ label: "TOTAL", value: formatMoney(order.total), kind: "total" });

  if (order.notes) {
    lines.push({ text: "ORDER NOTE", kind: "section" });
    lines.push(...wrap(order.notes).map((text) => ({ text, kind: "body" as const })));
  }
  lines.push(
    { text: "Payment is confirmed only when marked paid by the store.", kind: "muted" },
  );
  return lines;
}

function makeSvgFromLines(lines: ReceiptLine[]) {
  const width = 1000;
  const padding = 64;
  const lineHeight = 46;
  let y = 72;
  const content: string[] = [];

  for (const line of lines) {
    if (line.kind === "section") {
      y += 24;
      content.push(
        `<text x="${padding}" y="${y}" font-size="20" font-weight="700" letter-spacing="2" fill="#59685d">${escapeXml(line.text ?? "")}</text>`,
      );
      y += 22;
      content.push(
        `<line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#d6dfd6" stroke-width="2" />`,
      );
    } else if (line.kind === "title") {
      const wrapped = wrap(line.text ?? "", 32);
      for (const part of wrapped) {
        content.push(
          `<text x="${padding}" y="${y}" font-size="42" font-weight="700" fill="#173d2c">${escapeXml(part)}</text>`,
        );
        y += 54;
      }
    } else if (line.kind === "subtitle") {
      content.push(
        `<text x="${padding}" y="${y}" font-size="18" font-weight="700" letter-spacing="2" fill="#37794b">${escapeXml(line.text ?? "")}</text>`,
      );
      y += 38;
    } else if (line.label !== undefined) {
      const labelLines = wrap(line.label, 38);
      const valueLines = wrap(line.value ?? "", 24);
      const rows = Math.max(labelLines.length, valueLines.length);
      for (let index = 0; index < rows; index += 1) {
        const isTotal = line.kind === "total";
        content.push(
          `<text x="${padding}" y="${y}" font-size="${isTotal ? 30 : 23}" font-weight="${isTotal ? 700 : 400}" fill="${isTotal ? "#173d2c" : "#18251d"}">${escapeXml(labelLines[index] ?? "")}</text>`,
          `<text x="${width - padding}" y="${y}" text-anchor="end" font-size="${isTotal ? 30 : 23}" font-weight="${isTotal ? 700 : 500}" fill="${isTotal ? "#173d2c" : "#18251d"}">${escapeXml(valueLines[index] ?? "")}</text>`,
        );
        y += isTotal ? 48 : lineHeight;
      }
    } else {
      const kind = line.kind ?? "body";
      const color = kind === "muted" ? "#59685d" : "#18251d";
      const fontSize = kind === "muted" ? 18 : 22;
      const weight = kind === "muted" ? 400 : 500;
      for (const part of wrap(line.text ?? "")) {
        content.push(
          `<text x="${padding}" y="${y}" font-size="${fontSize}" font-weight="${weight}" fill="${color}">${escapeXml(part)}</text>`,
        );
        y += lineHeight;
      }
    }
  }

  y += 28;
  content.push(
    `<text x="${width - padding}" y="${y}" text-anchor="end" font-size="16" fill="#59685d">Made with PasaOrder</text>`,
  );
  const height = y + 48;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#f8faf7"/><rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="20" fill="#ffffff" stroke="#d6dfd6" stroke-width="2"/>${content.join("")}</svg>`;
}

function makeCustomerReceiptLines(order: CustomerReceiptOrder): ReceiptLine[] {
  const placedAt = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(order.createdAt));
  const lines: ReceiptLine[] = [
    { text: "PASAORDER · CUSTOMER RECEIPT", kind: "subtitle" },
    { text: `Order #${order.id} · ${placedAt} (Philippine time)`, kind: "body" },
    { label: "Order status", value: order.status.replaceAll("_", " ") },
    {
      label: "Fulfillment",
      value: order.orderType.replaceAll("_", " "),
    },
  ];
  if (order.tableNumber) lines.push({ label: "Table", value: order.tableNumber });
  if (order.scheduledFor) {
    lines.push({
      label: "Requested for",
      value: new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(new Date(order.scheduledFor)),
    });
  }
  lines.push({ text: "ITEMS", kind: "section" });
  for (const item of order.items) {
    const quantity = new Intl.NumberFormat("en-PH", {
      maximumFractionDigits: 3,
    }).format(item.quantity);
    const unit = item.quantityUnit === "KG" ? " kg" : "";
    const option = item.optionLabel ? ` · ${item.optionLabel}` : "";
    lines.push({
      label: `${quantity}${unit} × ${item.productName}${option}`,
      value: formatMoney(item.subtotal),
    });
    for (const addon of item.addOns) {
      lines.push({
        text: `   + ${addon.groupName}: ${addon.optionName} (${formatMoney(addon.price)})`,
        kind: "muted",
      });
    }
    for (const answer of item.productAnswers) {
      lines.push({ text: `   ${answer.label}: ${answer.value}`, kind: "muted" });
    }
  }
  for (const answer of order.formAnswers) {
    lines.push({ label: answer.label, value: answer.value });
  }
  lines.push({ label: "Items subtotal", value: formatMoney(order.itemsSubtotal) });
  if (order.orderType === "DELIVERY") {
    lines.push({
      label: "Delivery fee",
      value:
        order.deliveryFee === null
          ? "To be confirmed"
          : formatMoney(order.deliveryFee),
    });
  }
  const totalToConfirm = order.orderType === "DELIVERY" && order.deliveryFee === null;
  lines.push({
    label: "TOTAL",
    value: totalToConfirm ? "To be confirmed" : formatMoney(order.total),
    kind: "total",
  });
  lines.push(
    {
      label: "Payment",
      value: `${order.paymentMethod} · ${order.paymentStatus === "PAID" ? "Paid (verified by store)" : "Not yet verified"}`,
    },
    {
      text: "This is an order receipt, not proof of payment. Payment is confirmed only when marked paid by the store.",
      kind: "muted",
    },
  );
  return lines;
}

async function createReceiptImage(
  svgContent: string,
  orderId: string,
): Promise<{ blob: Blob; fileName: string }> {
  const svg = new Blob([svgContent], {
    type: "image/svg+xml;charset=utf-8",
  });
  const svgUrl = URL.createObjectURL(svg);

  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not render the receipt image."));
    });
    image.src = svgUrl;
    await loaded;

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth * 2;
    canvas.height = image.naturalHeight * 2;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");
    context.scale(2, 2);
    context.drawImage(image, 0, 0);

    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Could not create the receipt image."));
      }, "image/png");
    });
    return { blob: png, fileName: `pasaorder-order-${orderId}-receipt.png` };
  } catch {
    return { blob: svg, fileName: `pasaorder-order-${orderId}-receipt.svg` };
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

export function createOrderReceiptImage(
  storeName: string,
  order: OwnerOrder,
): Promise<{ blob: Blob; fileName: string }> {
  return createReceiptImage(
    makeSvgFromLines(receiptLines(storeName, order)),
    order.id,
  );
}

export function createCustomerOrderReceiptImage(
  storeName: string,
  order: CustomerReceiptOrder,
): Promise<{ blob: Blob; fileName: string }> {
  return createReceiptImage(
    makeSvgFromLines([
      { text: storeName, kind: "title" },
      ...makeCustomerReceiptLines(order),
    ]),
    order.id,
  );
}
