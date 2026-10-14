import "server-only";
import { cache } from "react";
import type { Catalog } from "@pasaorder/types";
import { slugSchema } from "@pasaorder/validation";
import { notFound } from "next/navigation";
import { ApiError, authApi } from "@/lib/auth";

const loadCatalog = cache(async (slug: string) =>
  authApi<Catalog>(`/public/stores/${encodeURIComponent(slug)}`),
);

export async function getPublicCatalog(slug: string): Promise<Catalog> {
  if (!slugSchema.safeParse(slug).success) notFound();
  try {
    return await loadCatalog(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
