import { getOwnerCatalog } from "@/lib/catalog";
import { MenuView } from "@/features/catalog/menu-view";
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const catalog = await getOwnerCatalog(id);
  return (
    <div className="-mx-5 -mt-7 overflow-hidden md:-mx-8 md:-my-9 lg:-mx-10 lg:-my-10">
      <MenuView catalog={catalog} preview />
    </div>
  );
}
