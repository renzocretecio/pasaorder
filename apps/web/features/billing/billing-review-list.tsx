"use client";

import { useActionState } from "react";
import type { OwnerSubscriptionPaymentReview } from "@pasaorder/types";
import { Button } from "@/components/ui/button";
import { reviewSubscriptionPayment, type BillingActionState } from "./actions";

const initialState: BillingActionState = {};

function submittedDate(value: string) {
  return new Date(value).toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

export function BillingReviewList({
  requests,
}: {
  requests: OwnerSubscriptionPaymentReview[];
}) {
  if (!requests.length)
    return (
      <div className="rounded-2xl border border-dashed px-5 py-12 text-center">
        <p className="font-medium">No payments waiting for review</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New GCash references will appear here.
        </p>
      </div>
    );

  return (
    <div className="divide-y rounded-2xl border bg-card">
      {requests.map((request) => (
        <ReviewItem key={request.id} request={request} />
      ))}
    </div>
  );
}

function ReviewItem({ request }: { request: OwnerSubscriptionPaymentReview }) {
  const [state, action, pending] = useActionState(
    reviewSubscriptionPayment,
    initialState,
  );

  return (
    <article className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)] lg:p-6">
      <div>
        <h2 className="font-semibold">{request.ownerName}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {request.ownerEmail}
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Amount</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              ₱{(request.amountMinor / 100).toFixed(2)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">GCash reference</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {request.reference}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Submitted</dt>
            <dd className="mt-1">{submittedDate(request.submittedAt)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Verify this reference and exact amount in the PasaOrder GCash account
          before approving it.
        </p>
      </div>

      <div className="space-y-3 lg:border-l lg:pl-6">
        <form action={action}>
          <input type="hidden" name="paymentId" value={request.id} />
          <input type="hidden" name="decision" value="APPROVE" />
          <Button
            type="submit"
            className="h-11 w-full rounded-xl"
            disabled={pending}
          >
            {pending ? "Saving…" : "Approve and activate Pro"}
          </Button>
        </form>
        <form action={action} className="space-y-2">
          <input type="hidden" name="paymentId" value={request.id} />
          <input type="hidden" name="decision" value="REJECT" />
          <textarea
            name="reason"
            maxLength={500}
            required
            rows={2}
            placeholder="Reason for rejecting this reference"
            aria-label="Reason for rejecting this reference"
            className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full resize-y rounded-xl border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]"
          />
          <Button
            type="submit"
            variant="outline"
            className="h-11 w-full rounded-xl"
            disabled={pending}
          >
            Reject payment
          </Button>
        </form>
        {state.message && (
          <p
            role={state.success ? "status" : "alert"}
            className={`text-sm leading-relaxed ${state.success ? "text-primary" : "text-destructive"}`}
          >
            {state.message}
          </p>
        )}
      </div>
    </article>
  );
}
