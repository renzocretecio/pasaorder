import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_ORIGIN ?? "http://localhost:3000"),
  title: "PasaOrder",
  description:
    "Simple online storefronts and order management for small businesses. Accept orders from a QR code or shareable link.",
  applicationName: "PasaOrder",
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: "PasaOrder",
    images: [
      {
        url: "/images/landing/merchant-counter.webp",
        width: 1672,
        height: 941,
        alt: "A neighborhood store owner managing customer orders with PasaOrder",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/landing/merchant-counter.webp"],
  },
  appleWebApp: {
    capable: true,
    title: "PasaOrder",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8faf7",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
