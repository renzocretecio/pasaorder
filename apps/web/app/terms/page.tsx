import type { Metadata } from "next";
import {
  LegalDocument,
  type LegalSection,
} from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service | PasaOrder",
  description:
    "Terms for using the PasaOrder storefront and order management service.",
  alternates: { canonical: "/terms" },
  openGraph: {
    type: "website",
    siteName: "PasaOrder",
    title: "Terms of Service | PasaOrder",
    description:
      "Terms for using the PasaOrder storefront and order management service.",
    url: "/terms",
    images: ["/images/landing/merchant-counter.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Terms of Service | PasaOrder",
    description:
      "Terms for using the PasaOrder storefront and order management service.",
    images: ["/images/landing/merchant-counter.webp"],
  },
};

const sections: LegalSection[] = [
  {
    title: "Agreement and eligibility",
    content: (
      <p>
        These Terms apply when you access or use PasaOrder, including its store
        owner workspace, public catalogs, checkout, and order management. By
        using the service, you agree to these Terms. If you use PasaOrder for a
        business, you confirm that you are authorized to act for it. You must be
        legally able to enter into this agreement.
      </p>
    ),
  },
  {
    title: "What PasaOrder provides",
    content: (
      <p>
        PasaOrder gives store owners tools to publish a catalog, manage products
        and options, receive customer orders, and manage an order queue.
        Customers may use a public store link or QR code to browse and place an
        order without creating an account. Depending on the store, checkout may
        include pickup, delivery, or dine-in, customer contact details, and an
        optional order note. Store owners can also enter orders manually; an
        unsynced manual order may be saved in the owner&apos;s browser until it
        can be sent to the service. Features may change as the service develops.
      </p>
    ),
  },
  {
    title: "Store owner responsibilities",
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          Keep account credentials secure and account information accurate.
        </li>
        <li>
          Use only content, images, and customer information that you are
          authorized to provide, and use customer information only as allowed by
          applicable law and your own customer notices.
        </li>
        <li>
          Keep catalog descriptions, prices, availability, operating details,
          payment instructions, and fulfillment options accurate.
        </li>
        <li>
          Review orders before confirming them, and handle customer requests,
          payment verification, fulfillment, refunds, and required notices for
          your business. You are responsible for protecting customer details
          saved in a browser you use to enter orders.
        </li>
        <li>
          Follow applicable laws and the terms of Google and any payment
          services you use.
        </li>
      </ul>
    ),
  },
  {
    title: "Customer orders and payments",
    content: (
      <p>
        A customer&apos;s order is submitted to the selected store. The store
        owner is responsible for accepting, confirming, preparing, delivering,
        or cancelling it. PasaOrder does not itself sell the store&apos;s items,
        determine final availability, or guarantee that a store will fulfill an
        order. Where a store provides GCash or other payment instructions,
        customers pay the store directly and the store verifies payment.
        PasaOrder does not process or settle those payments. Customers may
        upload payment proof for the store to review. An upload does not confirm
        that a payment was made or verified; the store owner must check and
        confirm it separately.
      </p>
    ),
  },
  {
    title: "Acceptable use",
    content: (
      <p>
        Do not use PasaOrder to break the law, infringe another person&apos;s
        rights, send spam, interfere with the service, attempt unauthorized
        access, upload malicious code, or misuse another person&apos;s account
        or personal information. We may investigate suspected abuse and restrict
        access when reasonably necessary to protect users or the service.
      </p>
    ),
  },
  {
    title: "Your content and service rights",
    content: (
      <p>
        You retain your rights to content you submit. You grant PasaOrder
        permission to host, store, display, and process that content as needed
        to provide and maintain the service and the features you choose.
        PasaOrder and its licensors retain rights in the service, software, and
        branding. These Terms do not transfer ownership of either party&apos;s
        intellectual property.
      </p>
    ),
  },
  {
    title: "Availability, suspension, and termination",
    content: (
      <p>
        We work to keep PasaOrder available but do not promise uninterrupted or
        error-free service. Features may be unavailable during maintenance or
        because a third-party service changes or becomes unavailable. You may
        stop using PasaOrder at any time. We may suspend or end access for a
        material Terms violation, security risk, legal requirement, or service
        discontinuation. We will provide notice where reasonably practicable.
      </p>
    ),
  },
  {
    title: "Disclaimers and liability",
    content: (
      <p>
        To the extent permitted by applicable law, PasaOrder is provided as
        available, without warranties that the service will meet every business
        requirement or that order information will always be accurate or
        available. Nothing in these Terms excludes liability that cannot
        lawfully be excluded. To the extent permitted by law, PasaOrder is not
        responsible for disputes between a store and its customers, including
        product quality, pricing, fulfillment, or payment disputes.
      </p>
    ),
  },
  {
    title: "Changes and governing law",
    content: (
      <p>
        We may update these Terms as the service changes. We will update the
        date on this page when we publish revisions. The laws of the Philippines
        govern these Terms, subject to mandatory protections that apply to you.
        Any dispute will be handled by the appropriate courts or authorities
        under applicable law.
      </p>
    ),
  },
  {
    title: "Contact",
    content: (
      <p>
        Questions about these Terms may be sent to{" "}
        <a
          className="font-medium text-[#244d35] underline underline-offset-4"
          href="mailto:renzocretecio@gmail.com"
        >
          renzocretecio@gmail.com
        </a>
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      summary="These Terms cover use of PasaOrder by store owners and customers. Please read them before creating an account or placing an order."
      sections={sections}
    />
  );
}
