import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Store } from "lucide-react";
import type { WorkspaceStore } from "@pasaorder/types";
import { ownerApi } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/features/catalog/workspace";

export const metadata: Metadata = { title: "Your store | PasaOrder" };

export default async function Dashboard() {
  const { stores } = await ownerApi<{ stores: WorkspaceStore[] }>(
    "/catalog/stores",
  );
  const defaultStore = stores.find((store) => store.isDefault) ?? stores[0];
  if (defaultStore) redirect(`/dashboard/stores/${defaultStore.id}/overview`);

  return (
    <>
      <PageHeading
        title="Your store starts here"
        description="Set up a store, add your catalog, and share it with customers."
      />
      <section className="flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed bg-card px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-xl bg-secondary text-primary">
          <Store className="size-6" aria-hidden="true" />
        </span>
        <h2 className="mt-6 text-[18px] font-semibold tracking-[-0.01em]">
          Create your first store
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Your catalog and orders will live in this store workspace.
        </p>
        <Button asChild className="mt-7 h-12">
          <Link href="/dashboard/new">
            Set up your store
            <ArrowUpRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </>
  );
}
