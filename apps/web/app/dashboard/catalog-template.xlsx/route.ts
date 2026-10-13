import ExcelJS from "exceljs";
import { MIN_CATALOG_IMPORT_ITEMS } from "@pasaorder/validation";
import { requireUser } from "@/lib/auth";

export async function GET() {
  await requireUser();
  const workbook = new ExcelJS.Workbook();
  const products = workbook.addWorksheet("Products", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  products.columns = [
    { header: "Category", key: "category", width: 24 },
    { header: "Product", key: "product", width: 32 },
    { header: "Description", key: "description", width: 48 },
    { header: "Price", key: "price", width: 16 },
    { header: "Options", key: "options", width: 42 },
    { header: "Available", key: "available", width: 16 },
  ];
  products.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  products.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF244D35" },
  };
  products.getRow(1).height = 28;
  products.autoFilter = "A1:F1";
  const guide = workbook.addWorksheet("How to use");
  guide.getColumn(1).width = 22;
  guide.getColumn(2).width = 85;
  guide.addRows([
    ["Column", "How to fill it"],
    [
      "Category",
      "Required. Existing categories are reused by name; new names create categories.",
    ],
    [
      "Product",
      "Required. Each product name must be unique within its category.",
    ],
    ["Description", "Optional. Up to 1,000 characters."],
    [
      "Price",
      "Required for a product without options. Example: 120 or 120.50. Leave blank when using Options.",
    ],
    [
      "Options",
      "Optional. Enter size or piece options as Name:price; Name:price. Example: Small:120; Large:150.",
    ],
    [
      "Available",
      "Optional. Yes by default. Use No to hide a product from ordering.",
    ],
    [
      "Example 1",
      "Coffee | Iced Americano | Espresso over ice | | Small:120; Large:150 | Yes",
    ],
    ["Example 2", "Pastries | Empanada | Baked fresh daily | 85 | | Yes"],
    [
      "Limit",
      `At least ${MIN_CATALOG_IMPORT_ITEMS} products per workbook. Images can be added after import.`,
    ],
  ]);
  guide.getRow(1).font = { bold: true };
  const bytes = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition":
        'attachment; filename="pasaorder-products-template.xlsx"',
      "cache-control": "private, no-store",
    },
  });
}
