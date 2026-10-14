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
          addresses, table numbers, order contents, payment status, and messages
          sent to a store through its public chat or connected Facebook Page.
        </p>
        <p>
          We also receive technical information needed to operate and protect
          the service, such as request, device, and diagnostic data. When an
          owner connects a Facebook Page, Meta provides Page and messaging
          information needed to receive and reply to messages. Meta may provide
          a customer profile name when available.
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
          To publish menus, accept customer orders, and help stores manage them.
        </li>
        <li>To deliver Messenger messages and owner-initiated replies.</li>
        <li>
          To sort conversations into review queues and, when an owner reviews a
          chat and Gemini is configured, prepare an editable order draft.
        </li>
        <li>To maintain, troubleshoot, secure, and improve PasaOrder.</li>
        <li>To respond to support, privacy, and legal requests.</li>
      </ul>
    ),
  },
  {
    title: "AI-assisted conversation review",
    content: (
      <>
        <p>
          PasaOrder uses a conversation classifier to help sort chats. When a
          store owner opens or retries an eligible conversation for order
          review, the conversation text and relevant store catalog context may
          be sent to Google Gemini to prepare a structured draft. Gemini is not
          the source of truth for products, prices, or availability. PasaOrder
          checks draft items against the store catalog, and the owner reviews
          and confirms any order. We do not use this feature to automatically
          place an order or send an AI reply to a customer.
        </p>
        <p>
          Store owners should avoid sending sensitive personal information in
          chats unless it is needed to handle the order. AI-generated drafts can
          be incomplete or incorrect and must be checked by the store.
        </p>
      </>
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
          delivery, authentication, AI-assisted review, and communications.
          Facebook/Meta processes information when a store connects its Page;
          Google processes conversation context when Gemini order extraction is
          used. Those providers handle data under their own terms and privacy
          notices.
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
        information, but no online service can promise absolute security. We
        keep information while it is needed to operate the account, fulfill and
        document orders, meet legal obligations, resolve disputes, and enforce
        our agreements. Retention periods vary by record type. When information
        is no longer needed, we intend to delete or de-identify it where
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
          Links and integrations to Meta, Google, and other services are subject
          to those services&apos; own privacy practices. This policy does not
          cover services we do not operate.
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
        to <strong>renzocretecio@gmail.com</strong>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      summary="This policy explains how PasaOrder handles information when store owners manage a catalog and orders, and when customers place an order or message a store."
      sections={sections}
    />
  );
}
