import type { Metadata } from "next";
import { Check, LockKeyhole } from "lucide-react";
import {
  OWNER_PLAN_ENTITLEMENTS,
  type OwnerBillingStatus,
  type OwnerEntitlements,
} from "@pasaorder/types";
import { PageHeading } from "@/features/catalog/workspace";
import { ownerApi } from "@/lib/catalog";
import { SubscriptionPaymentPanel } from "@/features/billing/subscription-payment-panel";

export const metadata: Metadata = { title: "Plan | PasaOrder" };
const freePlan = OWNER_PLAN_ENTITLEMENTS.FREE;
const proPlan = OWNER_PLAN_ENTITLEMENTS.PRO;

export default async function PlanPage() {
  const [plan, billing] = await Promise.all([
    ownerApi<OwnerEntitlements>("/catalog/plan"),
    ownerApi<OwnerBillingStatus>("/billing/status"),
  ]);
  const isPro = plan.plan === "PRO";

  return (
    <div className="space-y-7 pb-5 lg:space-y-8">
      <PageHeading
        title="Your plan"
        description="See what’s included and how your store limits work."
      />

      <section
        aria-labelledby="current-plan-title"
        className="rounded-2xl border bg-card p-5 sm:p-7"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="current-plan-title" className="text-lg font-semibold">
              Current plan: {isPro ? "Pro" : "Free"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {isPro
                ? "Your account has the expanded store, catalog, and reporting limits."
                : "You’re on the free beta plan. You can publish one store and keep up to 50 products available."}
            </p>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold text-primary">
            {isPro ? "Pro" : "Free beta"}
          </span>
        </div>
      </section>

      <section aria-labelledby="plans-title" className="space-y-4">
        <h2 id="plans-title" className="text-lg font-semibold">
          Plan details
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <PlanCard
            title="Free beta"
            price="₱0"
            description="Everything to publish a catalog and manage customer orders."
            features={[
              `${freePlan.maxStores} store`,
              `Up to ${freePlan.maxActiveProducts} active products per store`,
              `Up to ${freePlan.maxReportDays} days of sales reports`,
              "Order management and customer tracking",
            ]}
            current={!isPro}
          />
          <PlanCard
            title="Pro"
            price="₱299 / month"
            description="Manual GCash renewal. Pro stays active for one month after each approved payment."
            features={[
              `Up to ${proPlan.maxStores} stores`,
              proPlan.maxActiveProducts === null
                ? "Unlimited active products"
                : `Up to ${proPlan.maxActiveProducts} active products per store`,
              `Up to ${proPlan.maxReportDays} days of sales reports`,
              "Download sales reports as CSV",
            ]}
            current={isPro}
          />
        </div>
      </section>

      <SubscriptionPaymentPanel billing={billing} plan={plan.plan} />

      {!isPro && (
        <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <LockKeyhole
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          Pro renews manually and does not charge automatically. If a renewal
          isn’t approved by the end of the 7-day grace period, your plan returns
          to Free. Your stores and products remain available; Free limits apply
          to creating stores and activating products.
        </p>
      )}
    </div>
  );
}

function PlanCard({
  title,
  price,
  description,
  features,
  current,
}: {
  title: string;
  price: string;
  description: string;
  features: string[];
  current: boolean;
}) {
  return (
    <article className="flex h-full flex-col rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-2 text-xl font-semibold tracking-tight">{price}</p>
        </div>
        {current ? (
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-primary">
            Current
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      <ul className="mt-5 grid gap-3 border-t pt-5 text-sm">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
