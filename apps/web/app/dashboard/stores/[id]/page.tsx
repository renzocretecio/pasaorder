import Link from "next/link";
import { Eye, Settings2 } from "lucide-react";
import { getOwnerCatalog } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/features/catalog/workspace";
import { PublishPanel } from "@/features/catalog/forms";
import { CatalogOrder } from "@/features/catalog/catalog-order";
export default async function StoreCatalog({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { store, categories } = await getOwnerCatalog(id);
  const base = `/dashboard/stores/${id}`;
  const items = categories.flatMap((c) => c.items);
  const available = items.filter((i) => i.isAvailable).length;
  return (
    <>
      <PageHeading
        eyebrow="Stores / Catalog"
        title={store.name}
        description="Keep your items up to date, then share your catalog."
      >
        <Button asChild variant="outline" className="h-12 rounded-xl bg-card">
          <Link href={`${base}/preview`}>
            <Eye aria-hidden="true" />
            Preview
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12 rounded-xl bg-card">
          <Link href={`${base}/settings`}>
            <Settings2 aria-hidden="true" />
            Settings
          </Link>
        </Button>
      </PageHeading>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_272px]">
        <PublishPanel
          store={store}
          categoryCount={categories.length}
          available={available}
        />
        <CatalogOrder storeId={id} categories={categories} />
      </div>
    </>
  );
}
