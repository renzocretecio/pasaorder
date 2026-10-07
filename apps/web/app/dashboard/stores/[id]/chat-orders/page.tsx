import type { Metadata } from "next";
import Link from "next/link";
import type { ChatOrderDraftSummary } from "@pasaorder/types";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInbox } from "@/features/orders/chat-inbox";
import { PageHeading } from "@/features/catalog/workspace";
import { getOwnerCatalog, ownerApi } from "@/lib/catalog";

export const metadata: Metadata = { title: "Customer chats | PasaOrder" };

export default async function ChatOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ store }, { drafts, analysisAvailable }] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<{ drafts: ChatOrderDraftSummary[]; analysisAvailable: boolean }>(
      `/orders/stores/${id}/chat-drafts`,
    ),
  ]);

  return (
    <>
      <PageHeading
        eyebrow={`${store.name} / Customer chats`}
        title="Customer chats"
        description="Review possible orders and conversations that need your attention. Chats move as customers reply."
      >
        <Button asChild variant="outline" className="min-h-11 rounded-xl">
          <Link
            href={`/chat/${store.slug}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open customer chat
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </PageHeading>
      <ChatInbox
        storeId={id}
        drafts={drafts}
        analysisAvailable={analysisAvailable}
      />
    </>
  );
}
