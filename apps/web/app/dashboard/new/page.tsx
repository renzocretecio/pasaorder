import type { Metadata } from "next";
import { StoreForm } from "@/features/catalog/forms";
import { EditorPanel } from "@/features/catalog/workspace";
import Link from "next/link";
import type { OwnerEntitlements, WorkspaceStore } from "@pasaorder/types";
import { ownerApi } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = { title: "Set up your store | PasaOrder" };
export default async function NewStore() {
  const [{ stores }, plan] = await Promise.all([
    ownerApi<{ stores: WorkspaceStore[] }>("/catalog/stores"),
    ownerApi<OwnerEntitlements>("/catalog/plan"),
  ]);
  const atStoreLimit =
    plan.maxStores !== null && stores.length >= plan.maxStores;
  return (
    <EditorPanel
      title="Let’s set up your store."
      description="Start with the basics. Your catalog stays private until you’re ready to publish."
      back="/dashboard"
    >
      {atStoreLimit ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your Free plan includes one store. Review plan details to see the
            upcoming Pro limits.
          </p>
          <Button asChild className="h-11">
            <Link href="/dashboard/plan">View plans and limits</Link>
          </Button>
        </div>
      ) : (
        <StoreForm />
      )}
    </EditorPanel>
  );
}
