import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Catalog } from "@pasaorder/types";
import { slugSchema } from "@pasaorder/validation";
import { ApiError, authApi } from "@/lib/auth";
import { accentInk, accentText } from "@/features/catalog/color";
import { CustomerChatView } from "@/features/chat/customer-chat-view";

export const metadata: Metadata = {
  title: "Chat with a store | PasaOrder",
  robots: { index: false, follow: false },
};

export default async function CustomerChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  // This is a local testing surface, not the production customer ordering flow.
  if (process.env.NODE_ENV === "production") notFound();

  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();
  let catalog: Catalog;
  try {
    catalog = await authApi<Catalog>(`/public/stores/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const { store } = catalog;
  const ink = accentInk(store.accentColor);
  const style = {
    "--store-accent": store.accentColor,
    "--store-accent-text": accentText(store.accentColor),
    "--store-accent-ink": ink,
    "--store-accent-soft": `color-mix(in srgb, ${ink} 6%, white)`,
    "--primary": store.accentColor,
    "--primary-foreground": accentText(store.accentColor),
    "--ring": ink,
    colorScheme: "light",
  } as CSSProperties;

  return <CustomerChatView store={store} style={style} />;
}
