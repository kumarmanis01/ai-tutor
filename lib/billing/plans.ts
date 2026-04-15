/**
 * FILE OBJECTIVE:
 * - Canonical plan definitions for the launch pricing model.
 * - Prices are displayed inclusive of all taxes; bookkeeping stores base/GST separately.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/billing.plans.spec.ts (and tests updated to import from this file)
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot-planner | created billing plan constants for Standard/Family/Lite
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
  /** Duration in months */
  durationMonths: number
  billedDisplay?: string
  saveLabel?: string
  featured?: boolean
  childSlots?: number
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

function mkPlan(id: PlanId, billedRupees: number, durationMonths: number, label: string, perMonthDisplay: string, opts?: Partial<SubscriptionPlan>): SubscriptionPlan {
  const { base, gst } = splitInclusive(billedRupees)
  return {
    id,
    label,
    perMonthDisplay,
    billedRupees: round2(billedRupees),
    baseRupees: base,
    gstRupees: gst,
    durationMonths,
    billedDisplay: opts?.billedDisplay,
    saveLabel: opts?.saveLabel,
    featured: opts?.featured,
    childSlots: opts?.childSlots ?? 1,
  }
}

export const PLANS: Record<PlanId, SubscriptionPlan> = {
  standard_monthly: mkPlan('standard_monthly', 399, 1, 'Standard', '₹399/month', { featured: true }),
  family_monthly: mkPlan('family_monthly', 599, 1, 'Family (2 kids)', '₹599/month', { childSlots: 2 }),
  standard_annual: mkPlan('standard_annual', 3990, 12, 'Annual (Standard)', '₹332.50/month', { billedDisplay: 'billed ₹3,990', saveLabel: '2 months free' }),
  family_annual: mkPlan('family_annual', 5990, 12, 'Annual (Family)', '₹499.17/month', { billedDisplay: 'billed ₹5,990', saveLabel: '2 months free', childSlots: 2 }),
  lite_monthly: mkPlan('lite_monthly', 249, 1, 'Lite (basic)', '₹249/month'),
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function renewalDateStr(plan: SubscriptionPlan): string {
  const d = new Date()
  d.setMonth(d.getMonth() + plan.durationMonths)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default { PLANS, rupeesToPaise, renewalDateStr }
