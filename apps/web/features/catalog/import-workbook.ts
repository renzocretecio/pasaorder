import ExcelJS from "exceljs";
import {
  catalogImportSchema,
  MIN_CATALOG_IMPORT_ITEMS,
  MAX_CATALOG_IMPORT_ITEMS,
  type CatalogImportInput,
} from "@pasaorder/validation";

const headers = [
  "Category",
  "Product",
  "Description",
  "Price",
  "Options",
  "Available",
];
const maxFileBytes = 2 * 1024 * 1024;

function cellText(cell: ExcelJS.Cell, column: string) {
  const value = cell.value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value).trim();
  throw new Error(
    `${column} must be plain text or a number. Formulas and dates are not supported.`,
  );
}

export async function parseProductWorkbook(
  file: File,
): Promise<CatalogImportInput> {
  if (!file.name.toLowerCase().endsWith(".xlsx"))
    throw new Error("Choose an .xlsx workbook.");
  if (!file.size || file.size > maxFileBytes)
    throw new Error("Choose a workbook smaller than 2 MB.");
  const workbook = new ExcelJS.Workbook();
  try {
    // ExcelJS bundles an older Node Buffer type; the runtime buffer is compatible.
    await workbook.xlsx.load(
      Buffer.from(await file.arrayBuffer()) as unknown as Parameters<
        typeof workbook.xlsx.load
      >[0],
    );
  } catch {
    throw new Error(
      "This workbook could not be opened. Use the XLSX template and try again.",
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error("The workbook has no worksheet.");
  const actualHeaders = headers.map((_, index) =>
    cellText(sheet.getRow(1).getCell(index + 1), headers[index]),
  );
  if (
    actualHeaders.some(
      (header, index) => header.toLowerCase() !== headers[index].toLowerCase(),
    )
  )
    throw new Error(`The first row must be: ${headers.join(", ")}.`);
  if (sheet.rowCount > MAX_CATALOG_IMPORT_ITEMS + 1)
    throw new Error("The worksheet has too many rows.");
  const items: CatalogImportInput["items"] = [];
  const issues: string[] = [];
  const names = new Set<string>();
  sheet.eachRow((sheetRow, row) => {
    if (row === 1) return;
    try {
      const [category, name, description, price, options, available] =
        headers.map((header, index) =>
          cellText(sheetRow.getCell(index + 1), header),
        );
      if (
        ![category, name, description, price, options, available].some(Boolean)
      )
        return;
      let isAvailable = true;
      if (available) {
        if (["yes", "true", "1"].includes(available.toLowerCase()))
          isAvailable = true;
        else if (["no", "false", "0"].includes(available.toLowerCase()))
          isAvailable = false;
        else throw new Error("Available must be Yes or No");
      }
      const variants = options
        ? options.split(";").map((part) => {
            const separator = part.lastIndexOf(":");
            if (separator < 1)
              throw new Error("Use option:price; option:price in Options");
            return {
              label: part.slice(0, separator).trim(),
              price: part.slice(separator + 1).trim(),
            };
          })
        : [];
      const result = catalogImportSchema.shape.items.element.safeParse({
        row,
        category,
        name,
        description,
        ...(price ? { price } : {}),
        variants,
        isAvailable,
      });
      if (!result.success) {
        issues.push(
          `Row ${row}: ${result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
        );
      } else {
        const key = JSON.stringify([
          result.data.category.toLocaleLowerCase(),
          result.data.name.toLocaleLowerCase(),
        ]);
        if (names.has(key))
          issues.push(
            `Row ${row}: ${result.data.name} appears more than once in ${result.data.category}.`,
          );
        else {
          names.add(key);
          items.push(result.data);
        }
      }
    } catch (error) {
      issues.push(
        `Row ${row}: ${error instanceof Error ? error.message : "Invalid value"}`,
      );
    }
  });
  if (issues.length)
    throw new Error(
      issues.slice(0, 8).join("\n") +
        (issues.length > 8
          ? `\nAnd ${issues.length - 8} more row errors.`
          : ""),
    );
  if (items.length < MIN_CATALOG_IMPORT_ITEMS)
    throw new Error(
      `Add at least ${MIN_CATALOG_IMPORT_ITEMS} products below the header row.`,
    );
  return catalogImportSchema.parse({ items });
}
