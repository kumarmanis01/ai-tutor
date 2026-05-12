/**
 * FILE OBJECTIVE:
 * - Canonical plan definitions for the launch pricing model.
 * - Prices are displayed inclusive of all taxes; bookkeeping stores base/GST separately.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/billing.plans.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | created billing plan constants for Standard/Family/Lite
 * - 2026-04-15T00:00:00Z | staff-engineer  | added durationDays override for sub-monthly plans
 * - 2026-05-12T00:00:00Z | copilot | removed internal weekly plan from selective payment pick
 * - 2026-05-12T15:45:00Z | copilot | add resolvePlanByShortId function to convert short plan IDs to full SubscriptionPlan objects
 */

export type PlanId =
  | 'standard_monthly'
  | 'standard_annual'
  | 'family_monthly'
  | 'family_annual'
  | 'lite_monthly'

export interface SubscriptionPlan {
  id: PlanId
  label: string
  perMonthDisplay: string
  /** Total billed (inclusive of GST) in rupees */
  billedRupees: number
  /** Computed base price before GST (rupees, two decimals) */
  baseRupees: number
  /** Computed GST portion (rupees, two decimals) */
  gstRupees: number
  /** Duration in months -- used for endDate calculation on monthly/annual plans */
  durationMonths: number
  /**
   * Override: exact duration in days.
   * When set, takes precedence over durationMonths for endDate calculation.
   */
  durationDays?: number
  billedDisplay?: string
  saveLabel?: string
  featured?: boolean
  childSlots?: number
  /** True for internal plans that must not appear on the public pricing page */
  internal?: boolean
}

const GST_RATE = 0.18

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function splitInclusive(totalRupees: number) {
  const base = round2(totalRupees / (1 + GST_RATE))
  const gst = round2(totalRupees - base)
  return { base, gst }
}

function mkPlan(
  id: PlanId,
  billedRupees: number,
  durationMonths: number,
  label: string,
  perMonthDisplay: string,
  opts?: Partial<SubscriptionPlan>,
): SubscriptionPlan {
  const { base, gst } = splitInclusive(billedRupees)
  return {
    id,
    label,
    perMonthDisplay,
    billedRupees: round2(billedRupees),
    baseRupees: base,
    gstRupees: gst,
    durationMonths,
    durationDays: opts?.durationDays,
    billedDisplay: opts?.billedDisplay,
    saveLabel: opts?.saveLabel,
    featured: opts?.featured,
    childSlots: opts?.childSlots ?? 1,
    internal: opts?.internal,
  }
}

export const PLANS: Record<PlanId, SubscriptionPlan> = {
  standard_monthly: mkPlan('standard_monthly', 399, 1, 'Standard', '₹399/month', { featured: true }),
  standard_annual:  mkPlan('standard_annual', 3990, 12, 'Annual (Standard)', '₹332.50/month', { billedDisplay: 'billed ₹3,990', saveLabel: '2 months free' }),
  family_monthly:   mkPlan('family_monthly', 599, 1, 'Family', '₹599/month', { childSlots: 2 }),
  family_annual:    mkPlan('family_annual', 5990, 12, 'Annual (Family)', '₹499.17/month', { billedDisplay: 'billed ₹5,990', saveLabel: '2 months free', childSlots: 2 }),
  lite_monthly:     mkPlan('lite_monthly', 249, 1, 'Lite', '₹249/month'),
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

/** Compute the subscription end date from a plan, starting from a given date. */
export function planEndDate(plan: SubscriptionPlan, from: Date = new Date()): Date {
  if (plan.durationDays) {
    return new Date(from.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
  }
  const d = new Date(from)
  d.setMonth(d.getMonth() + plan.durationMonths)
  return d
}

export function renewalDateStr(plan: SubscriptionPlan): string {
  const d = planEndDate(plan)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Resolve a short plan ID (e.g. 'monthly', 'annual') to a full SubscriptionPlan.
 * Returns undefined if the plan is not found.
 */
export function resolvePlanByShortId(shortId: string): SubscriptionPlan | undefined {
  const normalized = String(shortId).toLowerCase().trim()
  
  // Check direct match first
  if (normalized in PLANS) {
    return PLANS[normalized as PlanId]
  }
  
  // Map short IDs to full plan IDs
  const shortIdMap: Record<string, PlanId> = {
    'monthly': 'standard_monthly',
    'annual': 'standard_annual',
    'quarterly': 'family_monthly',
    'family': 'family_monthly',
    'lite': 'lite_monthly',
    'standard': 'standard_monthly',
  }
  
  const fullId = shortIdMap[normalized]
  return fullId ? PLANS[fullId] : undefined
}

export default { PLANS, rupeesToPaise, planEndDate, renewalDateStr, resolvePlanByShortId }
