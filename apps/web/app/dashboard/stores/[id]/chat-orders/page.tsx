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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id } = await params;
  const { filter } = await searchParams;
  const [{ store }, { drafts, analysisAvailable }] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<{ drafts: ChatOrderDraftSummary[]; analysisAvailable: boolean }>(
      `/orders/stores/${id}/chat-drafts`,
    ),
  ]);

  return (
    <>
      <PageHeading
        title="Customer chats"
        description={`${store.name} · Review possible orders and conversations that need your attention. Chats move as customers reply.`}
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
        initialFilter={filter}
      />
    </>
  );
}
