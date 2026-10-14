import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/auth/",
        "/dashboard",
        "/login",
        "/register",
        "/chat/",
        "/order/",
      ],
    },
    sitemap: siteUrl("/sitemap.xml").toString(),
  };
}
