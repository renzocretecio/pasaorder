import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "PasaOrder",
    short_name: "PasaOrder",
    description: "Manage your store, catalog, and orders in one place.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#f8faf7",
    theme_color: "#244d35",
    icons: [
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
