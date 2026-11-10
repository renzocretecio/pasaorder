"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowUpRight, CheckCircle2, Clock3, CreditCard } from "lucide-react";
import type { OwnerBillingStatus, OwnerPlan } from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitSubscriptionPayment, type BillingActionState } from "./actions";

const initialState: BillingActionState = {};

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

export function SubscriptionPaymentPanel({
  billing,
  plan,
}: {
  billing: OwnerBillingStatus;
  plan: OwnerPlan;
}) {
  const [state, action, pending] = useActionState(
    submitSubscriptionPayment,
    initialState,
  );
  const active = plan === "PRO";
  const latestPaymentPending = billing.latestPayment?.status === "PENDING";

  return (
    <section
      aria-labelledby="subscription-title"
      className="rounded-2xl border bg-card p-5 sm:p-7"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
          <CreditCard className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 id="subscription-title" className="text-lg font-semibold">
            {active ? "Pro subscription" : "Upgrade to Pro"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            ₱{billing.monthlyPrice}/month · Submit your payment reference for
            review. Pro activates after the payment is verified.
          </p>
        </div>
      </div>

      {active && billing.subscription && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-semibold text-primary">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Pro active
          </span>
          <span className="text-muted-foreground">
            Paid through {dateTime(billing.subscription.periodEnd)}
          </span>
        </div>
      )}
      {billing.subscription?.status === "PAST_DUE" &&
        billing.subscription.gracePeriodEnd && (
          <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950">
            Your renewal is due. Pro remains active until{" "}
            {dateTime(billing.subscription.gracePeriodEnd)} while the 7-day
            grace period is open.
          </p>
        )}

      <div className="mt-6 max-w-xl">
        {latestPaymentPending ? (
          <div className="flex items-start gap-3 rounded-xl bg-muted/45 p-4">
            <Clock3
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold">Payment awaiting review</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Reference {billing.latestPayment?.reference}. We’ll update your
                plan after checking the payment.
              </p>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="gcash-reference">Payment reference number</Label>
              <Input
                id="gcash-reference"
                name="reference"
                required
                minLength={6}
                maxLength={80}
                autoComplete="off"
                placeholder="Enter the reference from your receipt"
                className="h-11 rounded-xl"
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Enter the reference number from your payment receipt. We’ll
                verify it manually before activating or extending Pro.
              </p>
            </div>
            <Button
              type="submit"
              className="h-11 w-full rounded-xl sm:w-auto sm:min-w-48"
              disabled={pending}
            >
              {pending
                ? "Submitting…"
                : active
                  ? "Submit renewal reference"
                  : "Submit payment reference"}
            </Button>
            {state.message && (
              <p
                role={state.success ? "status" : "alert"}
                className={`text-sm leading-relaxed ${state.success ? "text-primary" : "text-destructive"}`}
              >
                {state.message}
              </p>
            )}
          </form>
        )}
        {billing.latestPayment?.status === "REJECTED" && (
          <p className="mt-3 rounded-xl bg-destructive/5 px-4 py-3 text-sm leading-relaxed text-destructive">
            Previous reference {billing.latestPayment.reference} was not
            approved
            {billing.latestPayment.rejectionReason
              ? `: ${billing.latestPayment.rejectionReason}`
              : "."}{" "}
            You can submit a new reference.
          </p>
        )}
      </div>

      {billing.isBillingAdmin && (
        <div className="mt-6 border-t pt-4">
          <Link
            href="/dashboard/billing/review"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Review pending payments{" "}
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
