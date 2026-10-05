import type { Catalog } from "@pasaorder/types";
import { slugSchema } from "@pasaorder/validation";
import { notFound } from "next/navigation";
import { authApi, ApiError } from "@/lib/auth";
import { MenuView } from "@/features/catalog/menu-view";
export default async function PublicMenu({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!slugSchema.safeParse(slug).success) notFound();
  let catalog: Catalog;
  try {
    catalog = await authApi<Catalog>(`/public/stores/${slug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  return <MenuView catalog={catalog} />;
}
