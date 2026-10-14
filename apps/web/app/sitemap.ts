import type { MetadataRoute } from "next";
import type { PublishedStoreSlug } from "@pasaorder/types";
import { authApiBaseUrl } from "@/lib/auth";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: siteUrl("/").toString(), changeFrequency: "weekly", priority: 1 },
    {
      url: siteUrl("/privacy").toString(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
    {
      url: siteUrl("/terms").toString(),
      changeFrequency: "yearly",
      priority: 0.2,
    },
  ];

  try {
    const response = await fetch(`${authApiBaseUrl()}/public/stores`, {
      next: { revalidate: 900 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Public store listing unavailable");
    const result = (await response.json()) as {
      stores: PublishedStoreSlug[];
    };
    for (const store of result.stores) {
      pages.push({
        url: siteUrl(`/menu/${encodeURIComponent(store.slug)}`).toString(),
        changeFrequency: "weekly",
        priority: 0.8,
      });
    }
  } catch {
    console.error("Could not load published store URLs for the sitemap.");
  }

  return pages;
}
