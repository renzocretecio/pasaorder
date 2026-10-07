import { getOwnerCatalog } from "@/lib/catalog";
import { StoreForm } from "@/features/catalog/forms";
import { EditorPanel } from "@/features/catalog/workspace";
import { MessengerSettings } from "@/features/orders/messenger-settings";
import { ownerApi } from "@/lib/catalog";
import { ApiError } from "@/lib/auth";
export default async function Settings({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    messenger_session?: string;
    messenger_error?: string;
  }>;
}) {
  const [{ id }, search] = await Promise.all([params, searchParams]);
  const { store } = await getOwnerCatalog(id);
  const meta = await ownerApi<{
    configured: boolean;
    connection: {
      pageId: string;
      pageName: string;
      connectedAt: string;
    } | null;
  }>(`/meta/stores/${id}`).catch(() => ({
    configured: false,
    connection: null,
  }));
  let pages: { id: string; name: string }[] = [];
  let messengerMessage = search.messenger_error
    ? ({
        cancelled: "Facebook connection was cancelled.",
        no_pages: "No Facebook Pages were available for this account.",
        connect_failed:
          "Facebook connection failed. Check the Page permissions and try again.",
        invalid_state: "The connection session expired. Please try again.",
      }[search.messenger_error] ?? "Couldn’t connect Facebook Messenger.")
    : undefined;
  if (search.messenger_session) {
    try {
      const result = await ownerApi<{ pages: { id: string; name: string }[] }>(
        `/meta/stores/${id}/sessions/${encodeURIComponent(search.messenger_session)}`,
      );
      pages = result.pages;
    } catch (error) {
      messengerMessage =
        error instanceof ApiError
          ? error.message
          : "This Facebook connection expired. Start again.";
    }
  }
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
      <MessengerSettings
        storeId={id}
        configured={meta.configured}
        connection={meta.connection}
        sessionToken={search.messenger_session}
        pages={pages}
        initialMessage={messengerMessage}
      />
    </EditorPanel>
  );
}
