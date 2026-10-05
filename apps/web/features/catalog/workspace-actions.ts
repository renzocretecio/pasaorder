"use server";

import { revalidatePath } from "next/cache";
import { idSchema } from "@pasaorder/validation";
import { ApiError, requireUser } from "@/lib/auth";
import { ownerApi } from "@/lib/catalog";

export async function setDefaultStore(storeId: string) {
  await requireUser();
  if (!idSchema.safeParse(storeId).success)
    return { success: false, message: "Invalid store. Reload and try again." };
  try {
    await ownerApi(`/catalog/default-store/${storeId}`, { method: "PATCH" });
    revalidatePath("/dashboard");
    return { success: true, message: "Default store updated." };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t update the default store. Please try again.",
    };
  }
}
