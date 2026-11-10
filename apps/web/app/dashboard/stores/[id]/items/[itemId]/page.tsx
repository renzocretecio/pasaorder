import Link from "next/link";
import { notFound } from "next/navigation";
import { getOwnerCatalog } from "@/lib/catalog";
import { ItemForm } from "@/features/catalog/forms";
import { EditorPanel } from "@/features/catalog/workspace";
import { Button } from "@/components/ui/button";
import type { OwnerEntitlements } from "@pasaorder/types";
import { ownerApi } from "@/lib/catalog";
export default async function ItemEditor({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id, itemId } = await params;
  const [catalog, plan] = await Promise.all([
    getOwnerCatalog(id),
    ownerApi<OwnerEntitlements>("/catalog/plan"),
  ]);
  const item = catalog.categories
    .flatMap((c) => c.items)
    .find((p) => p.id === itemId);
  if (itemId !== "new" && !item) notFound();
  const activeItemCount = catalog.categories
    .flatMap((category) => category.items)
    .filter((product) => product.isAvailable).length;
  const atItemLimit =
    plan.maxActiveProducts !== null &&
    activeItemCount >= plan.maxActiveProducts;
  return (
    <EditorPanel
      title={item ? "Edit item" : "Add an item"}
      description="Set one price or add sizes and piece counts with their own prices. Saved changes appear in your published catalog."
      back={`/dashboard/stores/${id}`}
    >
      {itemId === "new" && atItemLimit ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            This store has {activeItemCount} active items. The Free plan allows
            up to {plan.maxActiveProducts}. Mark an item unavailable before
            adding another, or review your plan options.
          </p>
          <Button asChild variant="outline" className="h-11">
            <Link href={`/dashboard/stores/${id}`}>Back to catalog</Link>
          </Button>
          <Button asChild variant="ghost" className="h-11">
            <Link href="/dashboard/plan">View plans</Link>
          </Button>
        </div>
      ) : catalog.categories.length ? (
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
