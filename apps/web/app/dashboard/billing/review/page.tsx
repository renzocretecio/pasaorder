import type { Metadata } from "next";
import type {
  OwnerBillingStatus,
  OwnerSubscriptionPaymentReview,
} from "@pasaorder/types";
import { notFound } from "next/navigation";
import { PageHeading } from "@/features/catalog/workspace";
import { BillingReviewList } from "@/features/billing/billing-review-list";
import { ownerApi } from "@/lib/catalog";

export const metadata: Metadata = { title: "Review Pro payments | PasaOrder" };

export default async function BillingReviewPage() {
  const billing = await ownerApi<OwnerBillingStatus>("/billing/status");
  if (!billing.isBillingAdmin) notFound();
  const { requests } = await ownerApi<{
    requests: OwnerSubscriptionPaymentReview[];
  }>("/billing/admin/requests");

  return (
    <div className="space-y-7 pb-5 lg:space-y-8">
      <PageHeading
        title="Review Pro payments"
        description="Verify the GCash reference in the PasaOrder receiving account before approving a payment."
      />
      <BillingReviewList requests={requests} />
    </div>
  );
}
