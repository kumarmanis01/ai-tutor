/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/invoices re-exports verifying runtime exports exist.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/invoices.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-16T03:45:00Z | copilot | add unit test to verify invoices runtime exports after re-export fix
 */

import { generateInvoicePdf, createInvoiceForPayment } from '@/lib/invoices';

describe('lib/invoices exports', () => {
  it('should export runtime functions generateInvoicePdf and createInvoiceForPayment', () => {
    expect(typeof generateInvoicePdf).toBe('function');
    expect(typeof createInvoiceForPayment).toBe('function');
  });
});
