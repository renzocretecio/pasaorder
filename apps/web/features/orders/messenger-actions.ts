"use server";

import { revalidatePath } from "next/cache";
import { ApiError, requireUser } from "@/lib/auth";
import { ownerApi } from "@/lib/catalog";

export async function startMessengerConnect(storeId: string) {
  await requireUser();
  try {
    return await ownerApi<{ url: string }>(`/meta/stores/${storeId}/connect`, {
      method: "POST",
      body: "{}",
    });
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "Couldn’t start Facebook connection. Try again.",
    };
  }
}

export async function startInstagramConnect(storeId: string) {
  await requireUser();
  try {
    return await ownerApi<{ url: string }>(
      `/meta/stores/${storeId}/instagram/connect`,
      { method: "POST", body: "{}" },
    );
  } catch (error) {
    return {
      error:
        error instanceof ApiError
          ? error.message
          : "Couldn’t start Instagram connection. Try again.",
    };
  }
}

export async function selectInstagramAccount(
  storeId: string,
  sessionToken: string,
  instagramId: string,
) {
  await requireUser();
  try {
    await ownerApi(
      `/meta/stores/${storeId}/instagram/sessions/${encodeURIComponent(sessionToken)}/select`,
      { method: "POST", body: JSON.stringify({ instagramId }) },
    );
    revalidatePath(`/dashboard/stores/${storeId}/settings`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t connect this Instagram account. Try again.",
    };
  }
}

export async function disconnectInstagram(storeId: string) {
  await requireUser();
  try {
    await ownerApi(`/meta/stores/${storeId}/instagram`, { method: "DELETE" });
    revalidatePath(`/dashboard/stores/${storeId}/settings`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t disconnect Instagram. Try again.",
    };
  }
}

export async function selectMessengerPage(
  storeId: string,
  sessionToken: string,
  pageId: string,
) {
  await requireUser();
  try {
    await ownerApi(
      `/meta/stores/${storeId}/sessions/${encodeURIComponent(sessionToken)}/select`,
      { method: "POST", body: JSON.stringify({ pageId }) },
    );
    revalidatePath(`/dashboard/stores/${storeId}/settings`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t connect this Page. Try again.",
    };
  }
}

export async function disconnectMessenger(storeId: string) {
  await requireUser();
  try {
    await ownerApi(`/meta/stores/${storeId}`, { method: "DELETE" });
    revalidatePath(`/dashboard/stores/${storeId}/settings`);
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t disconnect Messenger. Try again.",
    };
  }
}
