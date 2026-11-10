export const ownerPlans = ["FREE", "PRO"] as const;
export type OwnerPlan = (typeof ownerPlans)[number];
export type OwnerSubscriptionStatus =
  "PENDING" | "ACTIVE" | "PAST_DUE" | "EXPIRED";
export type OwnerSubscriptionPaymentStatus =
  "PENDING" | "APPROVED" | "REJECTED";

export type OwnerBillingStatus = {
  isBillingAdmin: boolean;
  monthlyPrice: number;
  subscription: {
    status: OwnerSubscriptionStatus;
    periodStart: string | null;
    periodEnd: string | null;
    gracePeriodEnd: string | null;
  } | null;
  latestPayment: {
    id: string;
    reference: string;
    amountMinor: number;
    status: OwnerSubscriptionPaymentStatus;
    submittedAt: string;
    rejectionReason: string | null;
  } | null;
};

export type OwnerSubscriptionPaymentReview = {
  id: string;
  ownerName: string;
  ownerEmail: string;
  reference: string;
  amountMinor: number;
  submittedAt: string;
  subscriptionStatus: OwnerSubscriptionStatus;
  periodEnd: string | null;
};

export type OwnerEntitlements = {
  plan: OwnerPlan;
  maxStores: number | null;
  maxActiveProducts: number | null;
  maxReportDays: number;
  canExportReports: boolean;
};

export const OWNER_PLAN_ENTITLEMENTS: Record<OwnerPlan, OwnerEntitlements> = {
  FREE: {
    plan: "FREE",
    maxStores: 1,
    maxActiveProducts: 50,
    maxReportDays: 30,
    canExportReports: false,
  },
  PRO: {
    plan: "PRO",
    maxStores: 3,
    maxActiveProducts: null,
    maxReportDays: 365,
    canExportReports: true,
  },
};
