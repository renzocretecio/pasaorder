"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@pasaorder/validation";
import type { Catalog } from "@pasaorder/types";
import { ApiError, requireUser } from "@/lib/auth";
import { ownerApi } from "@/lib/catalog";
import { parseProductWorkbook } from "./import-workbook";

export async function previewProductImport(data: FormData) {
  await requireUser();
  const file = data.get("file");
  if (!(file instanceof File))
    return { success: false as const, message: "Choose an XLSX workbook." };
  try {
    const parsed = await parseProductWorkbook(file);
    return {
      success: true as const,
      count: parsed.items.length,
      sample: parsed.items.slice(0, 50),
    };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Could not read the workbook.",
    };
  }
}

export async function saveProductImport(storeId: string, data: FormData) {
  await requireUser();
  if (!idSchema.safeParse(storeId).success)
    return {
      success: false as const,
      message: "Invalid store. Reload and try again.",
    };
  const file = data.get("file");
  if (!(file instanceof File))
    return { success: false as const, message: "Choose an XLSX workbook." };
  let body: string;
  try {
    body = JSON.stringify(await parseProductWorkbook(file));
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof Error ? error.message : "Could not read the workbook.",
    };
  }
  if (Buffer.byteLength(body) > 7 * 1024 * 1024)
    return {
      success: false as const,
      message:
        "This workbook contains too much text to import at once. Shorten descriptions or split it into two files.",
    };
  try {
    const result = await ownerApi<{
      imported: number;
      createdCategories: number;
    }>(`/catalog/stores/${storeId}/items/import`, {
      method: "POST",
      body,
    });
    const catalog = await ownerApi<Catalog>(`/catalog/stores/${storeId}`);
    revalidatePath(`/dashboard/stores/${storeId}`);
    revalidatePath(`/menu/${catalog.store.slug}`);
    return { success: true as const, ...result };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Could not import products. Please try again.",
    };
  }
}
