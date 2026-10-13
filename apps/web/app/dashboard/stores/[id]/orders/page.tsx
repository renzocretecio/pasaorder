import type { Metadata } from "next";
import type { OwnerOrder, PastOrdersPage } from "@pasaorder/types";
import { PageHeading } from "@/features/catalog/workspace";
import { OrdersBoard } from "@/features/orders/orders-board";
import { getOwnerCatalog, ownerApi } from "@/lib/catalog";

export const metadata: Metadata = { title: "Orders | PasaOrder" };

export default async function StoreOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ queue?: string; order?: string }>;
}) {
  const { id } = await params;
  const { queue, order } = await searchParams;
  const [{ store }, { orders }, initialHistoryPage] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<{ orders: OwnerOrder[] }>(`/orders?storeId=${id}`),
    ownerApi<PastOrdersPage>(`/orders/stores/${id}/history`),
  ]);
  const loadedAt = new Date().toISOString();

  return (
    <>
      <PageHeading
        title="Orders"
        description={`${store.name} · Review orders and move each one to its next step.`}
      />
      <OrdersBoard
        orders={orders}
        initialHistoryPage={initialHistoryPage}
        loadedAt={loadedAt}
        storeId={id}
        initialQueue={queue}
        initialOrderId={order}
      />
    </>
  );
}
