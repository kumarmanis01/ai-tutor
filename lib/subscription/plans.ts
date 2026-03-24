/**
 * Subscription plan definitions -- v2 pricing.
 *
 * Amounts are in Indian Rupees (display) and paise (Razorpay).
 * GST is 18% levied on base price.
 * This file is imported by both API routes and UI components.
 */

export type PlanId = 'monthly' | 'quarterly' | 'annual';

export interface SubscriptionPlan {
  id: PlanId;
  label: string;
  perMonthDisplay: string;
  /** Total billed today (rupees, whole number) */
  billedRupees: number;
  /** GST portion (rupees, may be fractional) */
  gstRupees: number;
  /** Base price before GST (rupees) */
  baseRupees: number;
  /** Duration in calendar months for subscription expiry */
  durationMonths: number;
  /** Human-readable billed string shown in UI, e.g. "billed ₹267" */
  billedDisplay?: string;
  /** Savings badge shown on plan row, e.g. "Save 10%" */
  saveLabel?: string;
  /** Whether this plan has the featured border treatment */
  featured?: boolean;
}

const GST_RATE = 0.18;

function gst(base: number) {
  return Math.round(base * GST_RATE * 100) / 100;
}

function total(base: number) {
  return Math.round((base + gst(base)) * 100) / 100;
}

export const PLANS: Record<PlanId, SubscriptionPlan> = {
  monthly: {
    id: 'monthly',
    label: 'Monthly',
    perMonthDisplay: '₹99/month',
    baseRupees: 99,
    gstRupees: gst(99),        // 17.82
    billedRupees: total(99),    // 116.82
    durationMonths: 1,
  },
  quarterly: {
    id: 'quarterly',
    label: 'Quarterly',
    perMonthDisplay: '₹89/month',
    baseRupees: 267,            // 89 × 3
    gstRupees: gst(267),        // 48.06
    billedRupees: total(267),   // 315.06
    durationMonths: 3,
    billedDisplay: 'billed ₹267',
    saveLabel: 'Save 10%',
    featured: true,
  },
  annual: {
    id: 'annual',
    label: 'Annual',
    perMonthDisplay: '₹74/month',
    baseRupees: 891,            // 74.25 × 12 ≈ 891
    gstRupees: gst(891),        // 160.38
    billedRupees: total(891),   // 1051.38
    durationMonths: 12,
    billedDisplay: 'billed ₹891',
    saveLabel: 'Save 25%',
  },
};

/** Convert rupees to paise (Razorpay expects paise, integer). */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Renewal date string for a given plan starting now. */
export function renewalDateStr(plan: SubscriptionPlan): string {
  const d = new Date();
  d.setMonth(d.getMonth() + plan.durationMonths);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}
