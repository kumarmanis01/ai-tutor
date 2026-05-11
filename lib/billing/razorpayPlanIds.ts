/**
 * FILE OBJECTIVE:
 * - Maps each PlanId to its Razorpay Subscription Plan ID.
 * - Plan IDs are created in the Razorpay dashboard (Subscriptions > Plans).
 * - Live IDs are hardcoded as fallbacks; override via env vars for test/staging.
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | staff-engineer | created for C1 create-subscription endpoint
 * - 2026-05-11T00:00:00Z | staff-engineer | remove standard_quarterly (plan removed from lineup)
 */

import type { PlanId } from './plans'

/**
 * Razorpay Subscription Plan IDs.
 * Env vars take precedence (useful for staging overrides).
 * The literal fallbacks are the live plan IDs visible in the Razorpay dashboard.
 */
export const RAZORPAY_SUB_PLAN_IDS: Record<PlanId, string> = {
  standard_monthly: process.env.RAZORPAY_PLAN_STANDARD_MONTHLY ?? 'plan_SdptFLuFx3QjWU',
  standard_annual:  process.env.RAZORPAY_PLAN_STANDARD_ANNUAL  ?? 'plan_SdpvIxHJDL0rgL',
  family_monthly:   process.env.RAZORPAY_PLAN_FAMILY_MONTHLY   ?? 'plan_SdptsPYhklab0S',
  family_annual:    process.env.RAZORPAY_PLAN_FAMILY_ANNUAL     ?? 'plan_SdpusIRfHFOe21',
  lite_monthly:     process.env.RAZORPAY_PLAN_LITE_MONTHLY      ?? 'plan_SdpvokPVxrs91K',
  test_weekly:      process.env.RAZORPAY_PLAN_TEST_WEEKLY       ?? 'plan_SdpwjIiKc7ZBec',
}

/**
 * total_count passed to Razorpay subscriptions.create().
 * 0 = infinite recurring (Razorpay keeps billing until cancelled).
 * Higher values cap the number of charges (e.g. 1 for one-shot annual).
 * All plans use infinite recurring so the customer can cancel anytime.
 */
export const RAZORPAY_TOTAL_COUNT: Record<PlanId, number> = {
  standard_monthly: 0,
  standard_annual:  0,
  family_monthly:   0,
  family_annual:    0,
  lite_monthly:     0,
  test_weekly:      0,
}
