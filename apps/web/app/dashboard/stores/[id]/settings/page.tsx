import { getOwnerCatalog } from "@/lib/catalog";
import { StoreForm } from "@/features/catalog/forms";
import { EditorPanel } from "@/features/catalog/workspace";
export default async function Settings({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { store } = await getOwnerCatalog(id);
  return (
    <EditorPanel
      title="Store settings"
      description="Update how your store appears to customers. Published changes go live when you save."
      back={`/dashboard/stores/${id}`}
    >
      <p className="mb-7 break-all text-sm text-muted-foreground">
        Permanent menu link: /menu/{store.slug}
      </p>
      <StoreForm store={store} />
    </EditorPanel>
  );
}
