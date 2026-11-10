import { idSchema } from "@pasaorder/validation";
import type { OwnerEntitlements } from "@pasaorder/types";
import { notFound } from "next/navigation";
import { getOwnerCatalog, ownerApi } from "@/lib/catalog";
import { EditorPanel } from "@/features/catalog/workspace";
import { ProductImport } from "@/features/catalog/product-import";

export default async function ImportProducts({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  const [catalog, plan] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<OwnerEntitlements>("/catalog/plan"),
  ]);
  const activeItemCount = catalog.categories
    .flatMap((category) => category.items)
    .filter((item) => item.isAvailable).length;
  const remainingActiveItemSlots =
    plan.maxActiveProducts === null
      ? null
      : Math.max(0, plan.maxActiveProducts - activeItemCount);
  return (
    <EditorPanel
      title="Import products"
      description="Add products from an Excel workbook. Check the preview before importing them into your catalog."
      back={`/dashboard/stores/${id}`}
    >
      <ProductImport
        storeId={id}
        remainingActiveItemSlots={remainingActiveItemSlots}
        maxActiveProducts={plan.maxActiveProducts}
      />
    </EditorPanel>
  );
}
