import { redirect } from "next/navigation";
import type { WorkspaceStore } from "@pasaorder/types";
import { ownerApi } from "@/lib/catalog";

export default async function LegacyOrdersPage() {
  const { stores } = await ownerApi<{ stores: WorkspaceStore[] }>(
    "/catalog/stores",
  );
  const defaultStore = stores.find((store) => store.isDefault) ?? stores[0];
  if (!defaultStore) redirect("/dashboard");
  redirect(`/dashboard/stores/${defaultStore.id}/orders`);
}
