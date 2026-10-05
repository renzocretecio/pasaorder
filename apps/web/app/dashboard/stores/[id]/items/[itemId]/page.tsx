import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnerCatalog } from "@/lib/catalog";
import { ItemForm } from "@/features/catalog/forms";
import { EditorPanel } from "@/features/catalog/workspace";
import { Button } from "@/components/ui/button";
export default async function ItemEditor({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const catalog = await getOwnerCatalog(id);
  const item = catalog.categories
    .flatMap((c) => c.items)
    .find((p) => p.id === itemId);
  if (itemId !== "new" && !item) notFound();
  return (
    <EditorPanel
      title={item ? "Edit item" : "Add an item"}
      description="Set one price or add sizes and piece counts with their own prices. Saved changes appear in your published catalog."
      back={`/dashboard/stores/${id}`}
    >
      {catalog.categories.length ? (
        <ItemForm storeId={id} categories={catalog.categories} item={item} />
      ) : (
        <div>
          <p className="mb-4 text-muted-foreground">
            Add a category before creating your first item.
          </p>
          <Button asChild className="h-11">
            <Link href={`/dashboard/stores/${id}/categories/new`}>
              Add category
            </Link>
          </Button>
        </div>
      )}
    </EditorPanel>
  );
}
