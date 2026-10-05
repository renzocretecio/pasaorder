import type { Metadata } from "next";
import type { OwnerOrder } from "@pasaorder/types";
import { PageHeading } from "@/features/catalog/workspace";
import { OrdersBoard } from "@/features/orders/orders-board";
import { getOwnerCatalog, ownerApi } from "@/lib/catalog";

export const metadata: Metadata = { title: "Orders | PasaOrder" };

export default async function StoreOrdersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ store }, { orders }] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<{ orders: OwnerOrder[] }>(`/orders?storeId=${id}`),
  ]);
  const loadedAt = new Date().toISOString();

  return (
    <>
      <PageHeading
        eyebrow={`${store.name} / Orders`}
        title="Orders"
        description="Review this store’s orders and move each one to its next step."
      />
      <OrdersBoard orders={orders} loadedAt={loadedAt} storeId={id} />
    </>
  );
}
