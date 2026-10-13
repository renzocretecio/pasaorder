import { idSchema } from "@pasaorder/validation";
import { notFound } from "next/navigation";
import { getOwnerCatalog } from "@/lib/catalog";
import { EditorPanel } from "@/features/catalog/workspace";
import { ProductImport } from "@/features/catalog/product-import";

export default async function ImportProducts({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!idSchema.safeParse(id).success) notFound();
  await getOwnerCatalog(id);
  return (
    <EditorPanel
      title="Import products"
      description="Add products from an Excel workbook. Check the preview before importing them into your catalog."
      back={`/dashboard/stores/${id}`}
    >
      <ProductImport storeId={id} />
    </EditorPanel>
  );
}
