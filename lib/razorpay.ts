/**
 * FILE OBJECTIVE:
 * - Small helper to create a Razorpay client instance using env keys.
 *
 * LINKED UNIT TEST:
 * - tests/auto/lib/razorpay.ts.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add simple Razorpay client helper
 */

import Razorpay from 'razorpay';

export function getRazorpayClient(): Razorpay | null {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export default getRazorpayClient;
