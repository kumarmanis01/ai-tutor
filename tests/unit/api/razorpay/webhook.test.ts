/**
 * FILE OBJECTIVE:
 * - Sanity test ensuring the Razorpay webhook route module loads.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/razorpay/webhook.test.ts
 *
 * EDIT LOG:
 * - 2026-04-13T05:10:00Z | copilot | add sanity import test for razorpay webhook route
 */

import * as route from '@/app/api/razorpay/webhook/route';

describe('razorpay webhook route', () => {
  it('exports a POST handler', () => {
    expect(typeof route.POST).toBe('function');
  });
});
