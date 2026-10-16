import type { Metadata } from "next";
import {
  LegalDocument,
  type LegalSection,
} from "@/components/legal/legal-document";

export const metadata: Metadata = {
  title: "Privacy Policy | PasaOrder",
  description:
    "How PasaOrder collects, uses, and protects personal information.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    type: "website",
    siteName: "PasaOrder",
    title: "Privacy Policy | PasaOrder",
    description:
      "How PasaOrder collects, uses, and protects personal information.",
    url: "/privacy",
    images: ["/images/landing/merchant-counter.webp"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | PasaOrder",
    description:
      "How PasaOrder collects, uses, and protects personal information.",
    images: ["/images/landing/merchant-counter.webp"],
  },
};

const sections: LegalSection[] = [
  {
    title: "Information we handle",
    content: (
      <>
        <p>
          Depending on how you use PasaOrder, information may include account
          name and email, authentication identifiers, store name and settings,
          catalog text and images, customer names and contact details, delivery
          addresses, table numbers for applicable stores, order contents and
          notes, and payment status. Customers can upload a GCash payment proof
          image for an order; it is stored privately and made available to the
          receiving store owner for manual review. Some historical orders may
          include files uploaded through custom fields that are no longer
          offered. Store owners can enter orders manually, including while
          offline; unsynced orders are temporarily kept in that browser&apos;s
          local storage until they sync or are removed. For scheduled pickup and
          delivery, we store the requested date and time with the order. If a
          customer enables order alerts, we also store that browser&apos;s push
          endpoint and keys for that order. A store owner who enables new-order
          alerts has the same notification data stored for their account. We use
          these subscriptions only for the selected alerts and remove a customer
          subscription after the ready alert or when its endpoint expires.
        </p>
        <p>
          We also receive technical information needed to operate and protect
          the service, such as request, device, and diagnostic data. Customers
          may place catalog orders without creating an account. Their cart
          product and option selections and item instructions are saved in
          browser storage for up to seven days; customer contact and delivery
          details are not saved in that cart. PasaOrder does not currently
          connect to Facebook or Instagram messaging.
        </p>
      </>
    ),
  },
  {
    title: "How information is used",
    content: (
      <ul className="list-disc space-y-2 pl-5">
        <li>To create accounts and authenticate store owners.</li>
        <li>
          To publish catalogs, accept customer orders, and help stores manage
          them.
        </li>
        <li>To maintain, troubleshoot, secure, and improve PasaOrder.</li>
        <li>
          To send optional new-order alerts to store owners and one-time
          order-ready alerts to customers who opt in on their device.
        </li>
        <li>To respond to support, privacy, and legal requests.</li>
      </ul>
    ),
  },
  {
    title: "Previously collected conversation data",
    content: (
      <p>
        PasaOrder no longer offers customer chat, Messenger or Instagram
        integrations, or AI-assisted chat order drafting. Conversation records
        collected while those features were available may remain in storage
        under the retention practices described below. They are not available
        through the current app interface or API. Contact us to ask about a
        specific record or request deletion where applicable.
      </p>
    ),
  },
  {
    title: "When information is shared",
    content: (
      <>
        <p>
          We share information only as needed to provide the service, at the
          store owner&apos;s direction, or as required by law. Service providers
          may process data for hosting, database operations, image storage and
          delivery, and authentication. Historical records may reflect features
          that are no longer available. Those providers handle data under their
          own terms and privacy notices.
        </p>
        <p>
          Historical order files and GCash payment proof images are stored
          privately and can be opened by the owner of the store receiving that
          order.
        </p>
        <p>
          A store owner controls the store&apos;s catalog and order workflow and
          decides how to respond to its customers. Customers who order from a
          store should also review that store&apos;s privacy information for how
          it uses customer details outside PasaOrder.
        </p>
      </>
    ),
  },
  {
    title: "Storage, security, and retention",
    content: (
      <p>
        We use technical and organizational safeguards intended to protect
        information, but no online service can promise absolute security. The
        customer cart is removed from browser storage after seven days. An
        owner&apos;s unsynced manual orders remain in that browser until they
        sync or the owner removes them; anyone with access to that browser
        profile may be able to access them. Server-side account and order
        records are retained while needed to provide the service, handle orders,
        meet legal obligations, resolve disputes, and enforce agreements. The
        applicable period depends on the record and purpose. When information is
        no longer needed, we intend to delete or de-identify it where
        practicable, subject to legal and operational requirements.
      </p>
    ),
  },
  {
    title: "Your choices and privacy rights",
    content: (
      <>
        <p>
          You may ask to access or correct personal information, object to or
          restrict certain processing, request deletion or blocking where
          applicable, or raise a privacy concern. Contact the PasaOrder operator
          using the address above. We may need to verify your identity and may
          retain information that we are legally required or otherwise permitted
          to keep.
        </p>
        <p>
          Under Philippine law, data subjects have rights that include being
          informed, access, correction, objection, erasure or blocking in
          applicable cases, and filing a complaint with the National Privacy
          Commission. The specific rights and exceptions depend on the
          circumstances. See the{" "}
          <a
            className="font-medium text-[#244d35] underline underline-offset-4"
            href="https://privacy.gov.ph/data-subject-rights/"
            rel="noreferrer"
            target="_blank"
          >
            National Privacy Commission&apos;s data subject rights guide
          </a>
          .
        </p>
      </>
    ),
  },
  {
    title: "Children and third-party services",
    content: (
      <>
        <p>
          PasaOrder is intended for store owners and customers placing ordinary
          store orders, not for children to create accounts. We do not knowingly
          seek to collect children&apos;s personal information for account
          creation.
        </p>
        <p>
          Links to Google and other services are subject to those services&apos;
          own privacy practices. This policy does not cover services we do not
          operate.
        </p>
      </>
    ),
  },
  {
    title: "Changes and contact",
    content: (
      <p>
        We may update this policy as PasaOrder changes. We will revise the date
        above when we publish a new version. Questions or requests can be sent
        to{" "}
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

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary="This policy explains how PasaOrder handles information when store owners manage a catalog and orders, and when customers place an order."
      sections={sections}
    />
  );
}
