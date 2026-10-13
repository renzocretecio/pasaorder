"use server";

import { revalidatePath } from "next/cache";
import {
  confirmChatOrderDraftSchema,
  idSchema,
  updateChatOrderDraftSchema,
} from "@pasaorder/validation";
import type {
  ChatDecision,
  ChatExtractionReview,
  ChatOrderDraft,
  ChatOrderDraftData,
  ChatRoute,
  ChatReviewContext,
} from "@pasaorder/types";
import { ApiError, requireUser } from "@/lib/auth";
import { ownerApi } from "@/lib/catalog";

function failure(error: unknown) {
  return {
    success: false as const,
    message:
      error instanceof ApiError
        ? error.message
        : "Couldn’t save this draft. Please try again.",
  };
}

export async function saveChatDraft(
  draftId: string,
  input: { conversationText: string; draftData: ChatOrderDraftData },
) {
  await requireUser();
  if (!idSchema.safeParse(draftId).success)
    return { success: false as const, message: "This draft is invalid." };
  const parsed = updateChatOrderDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      message: "Check the conversation and order details, then try again.",
    };
  try {
    await ownerApi(`/orders/chat-drafts/${draftId}`, {
      method: "PATCH",
      body: JSON.stringify(parsed.data),
    });
    revalidatePath("/dashboard/stores");
    return { success: true as const, message: "Draft saved." };
  } catch (error) {
    return failure(error);
  }
}

export async function prepareChatDraft(draftId: string, force = false) {
  await requireUser();
  if (!idSchema.safeParse(draftId).success)
    return { success: false as const, message: "This draft is invalid." };
  try {
    const result = await ownerApi<
      | {
          skipped: true;
          route: Exclude<ChatRoute, "EXTRACT_ORDER">;
          context: ChatReviewContext | null;
          decision: ChatDecision;
          conversationText: string;
        }
      | { skipped: false; review: ChatExtractionReview }
    >(`/orders/chat-drafts/${draftId}/prepare`, {
      method: "POST",
      body: JSON.stringify({ force }),
      signal: AbortSignal.timeout(45000),
    });
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof ApiError && error.status === 503)
      return {
        success: false as const,
        message:
          "Couldn’t prepare this draft. Check the API server’s Gemini key and quota, then try again.",
      };
    return failure(error);
  }
}

export async function readChatDraft(draftId: string) {
  await requireUser();
  if (!idSchema.safeParse(draftId).success)
    return { success: false as const, message: "This draft is invalid." };
  try {
    const { draft } = await ownerApi<{ draft: ChatOrderDraft }>(
      `/orders/chat-drafts/${draftId}`,
    );
    return { success: true as const, draft };
  } catch (error) {
    return failure(error);
  }
}

export async function replyMetaDraft(draftId: string, text: string) {
  await requireUser();
  if (!idSchema.safeParse(draftId).success)
    return { success: false as const, message: "This draft is invalid." };
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 2000)
    return {
      success: false as const,
      message: "Write a reply of up to 2,000 characters.",
    };
  try {
    const result = await ownerApi<{ conversationText: string }>(
      `/meta/chat-drafts/${draftId}/replies`,
      { method: "POST", body: JSON.stringify({ text: trimmed }) },
    );
    revalidatePath("/dashboard/stores");
    return {
      success: true as const,
      conversationText: result.conversationText,
    };
  } catch (error) {
    return {
      success: false as const,
      message:
        error instanceof ApiError
          ? error.message
          : "Couldn’t send this reply. Please try again.",
    };
  }
}

export async function confirmChatDraft(
  draftId: string,
  input: ChatOrderDraftData & { expectedConversationText?: string },
) {
  await requireUser();
  if (!idSchema.safeParse(draftId).success)
    return { success: false as const, message: "This draft is invalid." };
  const parsed = confirmChatOrderDraftSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      message:
        parsed.error.issues[0]?.message ??
        "Complete the required order details.",
    };
  try {
    const { orderId } = await ownerApi<{ orderId: string }>(
      `/orders/chat-drafts/${draftId}/confirm`,
      { method: "POST", body: JSON.stringify(parsed.data) },
    );
    revalidatePath("/dashboard/orders");
    return { success: true as const, orderId };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteChatDraft(draftId: string) {
  await requireUser();
  if (!idSchema.safeParse(draftId).success)
    return { success: false as const, message: "This draft is invalid." };
  try {
    await ownerApi(`/orders/chat-drafts/${draftId}`, { method: "DELETE" });
    revalidatePath("/dashboard/stores");
    return { success: true as const };
  } catch (error) {
    return failure(error);
  }
}
