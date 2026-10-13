import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { parseProductWorkbook } from "../features/catalog/import-workbook.ts";

async function workbookFile(rows) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Products");
  for (const row of rows) sheet.addRow(row);
  return new File(
    [new Uint8Array(await workbook.xlsx.writeBuffer())],
    "products.xlsx",
    {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  );
}

const headers = [
  "Category",
  "Product",
  "Description",
  "Price",
  "Options",
  "Available",
];

test("imports fixed-price and size-option products with row numbers", async () => {
  const file = await workbookFile([
    headers,
    [
      "Coffee",
      "Iced Americano",
      "Espresso over ice",
      "",
      "Small:120; Large:150",
      "Yes",
    ],
    ["Pastries", "Empanada", "Baked fresh", 85, "", "No"],
    ["Coffee", "Latte", "", 130, "", "Yes"],
    ["Coffee", "Cappuccino", "", 140, "", "Yes"],
    ["Pastries", "Croissant", "", 95, "", "Yes"],
  ]);
  const result = await parseProductWorkbook(file);
  assert.equal(result.items.length, 5);
  assert.deepEqual(result.items[0].variants, [
    { label: "Small", price: "120" },
    { label: "Large", price: "150" },
  ]);
  assert.equal(result.items[0].row, 2);
  assert.equal(result.items[1].price, "85");
  assert.equal(result.items[1].isAvailable, false);
});

test("rejects duplicate products and ambiguous pricing before save", async () => {
  const file = await workbookFile([
    headers,
    ["Coffee", "Iced Americano", "", 120, "", "Yes"],
    ["coffee", "iced americano", "", 120, "", "Yes"],
    ["Tea", "Matcha", "", 120, "Large:150", "Yes"],
  ]);
  await assert.rejects(
    parseProductWorkbook(file),
    /Row 3:.*more than once.*Row 4:.*Leave Price blank/s,
  );
});

test("rejects formulas rather than using cached values", async () => {
  const file = await workbookFile([
    headers,
    ["Coffee", "Latte", "", { formula: "100+20", result: 120 }, "", "Yes"],
  ]);
  await assert.rejects(
    parseProductWorkbook(file),
    /Formulas and dates are not supported/,
  );
});

test("requires five products and accepts a larger ready-made catalog", async () => {
  const products = Array.from({ length: 25 }, (_, index) => [
    "Coffee",
    `Drink ${index + 1}`,
    "",
    100,
    "",
    "Yes",
  ]);
  const accepted = await parseProductWorkbook(
    await workbookFile([headers, ...products]),
  );
  assert.equal(accepted.items.length, 25);
  await assert.rejects(
    parseProductWorkbook(
      await workbookFile([headers, ...products.slice(0, 4)]),
    ),
    /Add at least 5 products/,
  );
});
