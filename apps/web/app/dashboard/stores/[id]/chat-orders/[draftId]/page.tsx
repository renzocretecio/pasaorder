import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ChatOrderDraft } from "@pasaorder/types";
import { PageHeading } from "@/features/catalog/workspace";
import { ChatDraftEditor } from "@/features/orders/chat-draft-editor";
import { getOwnerCatalog, ownerApi } from "@/lib/catalog";
import { ApiError } from "@/lib/auth";

export const metadata: Metadata = { title: "Review chat | PasaOrder" };

export default async function ChatOrderDraftPage({
  params,
}: {
  params: Promise<{ id: string; draftId: string }>;
}) {
  const { id, draftId } = await params;
  const [{ store, categories }, result] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<{
      draft: ChatOrderDraft;
      analysisAvailable: boolean;
      extractionAvailable: boolean;
    }>(`/orders/chat-drafts/${draftId}`).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 404) notFound();
      throw error;
    }),
  ]);
  if (result.draft.storeId !== id || result.draft.status !== "DRAFT")
    notFound();

  return (
    <>
      <PageHeading
        title="Review chat"
        description={`${store.name} · Read the conversation, then prepare and confirm an order if the customer is ready.`}
      />
      <div className="mx-auto max-w-6xl">
        <ChatDraftEditor
          key={draftId}
          draft={result.draft}
          analysisAvailable={result.analysisAvailable}
          extractionAvailable={result.extractionAvailable}
          storeId={id}
          categories={categories}
          orderTypes={store.orderTypes}
          paymentMethods={store.paymentMethods}
        />
      </div>
    </>
  );
}
