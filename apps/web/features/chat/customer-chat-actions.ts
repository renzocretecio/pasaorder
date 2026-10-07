"use server";

import type { CustomerChat, CustomerChatMessage } from "@pasaorder/types";
import {
  customerChatTokenSchema,
  sendCustomerChatMessageSchema,
  slugSchema,
  startCustomerChatSchema,
} from "@pasaorder/validation";
import { authApi, ApiError } from "@/lib/auth";

function failure(error: unknown) {
  return {
    success: false as const,
    status: error instanceof ApiError ? error.status : 503,
    message:
      error instanceof ApiError
        ? error.message
        : "We couldn’t reach the store. Please try again.",
  };
}

export async function startCustomerChat(slug: string, name: string) {
  const validSlug = slugSchema.safeParse(slug);
  const input = startCustomerChatSchema.safeParse({ customerName: name });
  if (!validSlug.success || !input.success)
    return { success: false as const, message: "Enter your name to continue." };
  try {
    const result = await authApi<{ token: string; chat: CustomerChat }>(
      `/public/chats/stores/${validSlug.data}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.data),
      },
    );
    return { success: true as const, ...result };
  } catch (error) {
    return failure(error);
  }
}

export async function readCustomerChat(token: string) {
  if (!customerChatTokenSchema.safeParse(token).success)
    return {
      success: false as const,
      status: 404,
      message: "This chat link has expired.",
    };
  try {
    const { chat } = await authApi<{ chat: CustomerChat }>(
      `/public/chats/${token}`,
    );
    return { success: true as const, chat };
  } catch (error) {
    return failure(error);
  }
}

export async function sendCustomerChatMessage(
  token: string,
  messageId: string,
  text: string,
) {
  if (!customerChatTokenSchema.safeParse(token).success)
    return { success: false as const, message: "This chat link has expired." };
  const input = sendCustomerChatMessageSchema.safeParse({ messageId, text });
  if (!input.success)
    return {
      success: false as const,
      message: "Write a message under 1,000 characters.",
    };
  try {
    const { messages } = await authApi<{ messages: CustomerChatMessage[] }>(
      `/public/chats/${token}/messages`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.data),
      },
    );
    return { success: true as const, messages };
  } catch (error) {
    return failure(error);
  }
}
