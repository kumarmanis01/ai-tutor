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
 * - 2026-04-15T00:00:00Z | staff-engineer  | added test_weekly; durationDays override for sub-monthly plans
 * - 2026-04-15T12:00:00Z | copilot | replace anonymous default export with named variable
 * - 2026-04-16T03:30:00Z | copilot | add resolvePlanByShortId helper to map short plan ids to PLANS entries
 */

export type PlanId =
  | 'standard_monthly'
  | 'standard_annual'
  | 'family_monthly'
  | 'family_annual'
  | 'lite_monthly'
  | 'test_weekly'

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
   * Used for test_weekly (7 days).
   */
  durationDays?: number
  billedDisplay?: string
  saveLabel?: string
  featured?: boolean
  childSlots?: number
  /** True for internal/test plans that must not appear on the public pricing page */
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
  // Family pricing: one subscription covers up to 3 children at 1.8x the standard price
  family_monthly:   mkPlan('family_monthly', Math.round(399 * 1.8 * 100) / 100, 1, 'Family (up to 3 kids)', `₹${(Math.round(399 * 1.8 * 100) / 100).toFixed(2)}/month`, { childSlots: 3 }),
  family_annual:    mkPlan('family_annual', Math.round(3990 * 1.8 * 100) / 100, 12, 'Annual (Family)', `₹${(Math.round(3990 * 1.8 * 100) / 100 / 12).toFixed(2)}/month`, { billedDisplay: `billed ₹${Math.round(3990 * 1.8)}`, saveLabel: '2 months free', childSlots: 3 }),
  lite_monthly:     mkPlan('lite_monthly', 249, 1, 'Lite', '₹249/month'),
  // Internal test plan: ₹1/week, visible only to whitelisted accounts.
  test_weekly:      mkPlan('test_weekly', 1, 0, 'Test (Weekly)', '₹1/week', { durationDays: 7, internal: true }),
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

const Billing = { PLANS, rupeesToPaise, planEndDate, renewalDateStr }

export default Billing

/**
 * Resolve a short plan id (e.g. 'monthly', 'annual') to a concrete SubscriptionPlan
 * in `PLANS`. If `isFamily` is true, prefer the family variant when available.
 */
export function resolvePlanByShortId(shortId: string, isFamily = false): SubscriptionPlan | undefined {
  if (!shortId || typeof shortId !== 'string') return undefined;
  // Exact match (allows callers to pass full keys like 'standard_annual')
  if ((PLANS as any)[shortId]) return (PLANS as any)[shortId] as SubscriptionPlan;

  // Try family/standard variants
  const familyKey = (`family_${shortId}`) as PlanId;
  const standardKey = (`standard_${shortId}`) as PlanId;
  if (isFamily && (PLANS as any)[familyKey]) return (PLANS as any)[familyKey] as SubscriptionPlan;
  if ((PLANS as any)[standardKey]) return (PLANS as any)[standardKey] as SubscriptionPlan;

  // Fallback: find any plan whose key ends with _<shortId>
  for (const k of Object.keys(PLANS)) {
    if (k.endsWith(`_${shortId}`)) return PLANS[k as PlanId];
  }

  return undefined;
}
