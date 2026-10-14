import type { Metadata } from "next";
import { getPublicCatalog } from "@/lib/public-catalog";
import { MenuView } from "@/features/catalog/menu-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { store } = await getPublicCatalog(slug);
  const title = `${store.name} menu | PasaOrder`;
  const description =
    store.description?.trim() ||
    `Browse ${store.name}'s menu and place an order online with PasaOrder.`;
  const url = `/menu/${encodeURIComponent(store.slug)}`;
  const image =
    store.bannerUrl || store.logoUrl || "/images/landing/merchant-counter.webp";

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "en_PH",
      siteName: "PasaOrder",
      title,
      description,
      url,
      images: [{ url: image, alt: `${store.name} menu` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicMenu({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await getPublicCatalog(slug);
  return <MenuView catalog={catalog} />;
}
