import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import type { WorkspaceStore } from "@pasaorder/types";
import { ownerApi } from "@/lib/catalog";
import { WorkspaceNavigation } from "@/features/catalog/workspace-navigation";
export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  const { stores } = await ownerApi<{ stores: WorkspaceStore[] }>(
    "/catalog/stores",
  );
  return (
    <div className="merchant-theme min-h-dvh bg-background text-foreground md:grid md:grid-cols-[88px_minmax(0,1fr)] md:grid-rows-[auto_1fr] xl:grid-cols-[216px_minmax(0,1fr)]">
      <a
        href="#main-content"
        className="fixed top-3 left-4 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground focus:translate-y-0"
      >
        Skip to content
      </a>
      <WorkspaceNavigation
        name={user.name}
        email={user.email}
        stores={stores}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-6xl px-5 pt-7 pb-[calc(6rem+env(safe-area-inset-bottom))] scroll-mt-24 outline-none md:col-start-2 md:px-8 md:py-9 lg:px-10 lg:py-10"
      >
        {children}
      </main>
    </div>
  );
}
