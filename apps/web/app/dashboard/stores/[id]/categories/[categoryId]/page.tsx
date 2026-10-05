import { notFound } from "next/navigation";
import { getOwnerCatalog } from "@/lib/catalog";
import { CategoryForm } from "@/features/catalog/forms";
import { EditorPanel } from "@/features/catalog/workspace";
export default async function CategoryEditor({
  params,
}: {
  params: Promise<{ id: string; categoryId: string }>;
}) {
  const { id, categoryId } = await params;
  const catalog = await getOwnerCatalog(id);
  const category = catalog.categories.find((c) => c.id === categoryId);
  if (categoryId !== "new" && !category) notFound();
  return (
    <EditorPanel
      title={category ? "Edit category" : "Add a category"}
      description="Group related items so customers can find what they’re looking for."
      back={`/dashboard/stores/${id}`}
    >
      <CategoryForm storeId={id} category={category} />
    </EditorPanel>
  );
}
