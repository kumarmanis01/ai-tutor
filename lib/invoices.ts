/**
 * FILE OBJECTIVE:
 * - Minimal invoice helper for tests and lightweight usage. Produces a PDF buffer
 *   placeholder and returns invoice metadata.
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-subscription-verify.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add minimal invoices helper for tests
 */

/**
 * FILE OBJECTIVE:
 * - Façade re-export for invoice utilities. Forwards to the full implementation
 *   in `lib/invoices/index.ts` so callers importing `@/lib/invoices` receive the
 *   rich API (including `studentId`, `planLabel`, `billingCycle`, etc.).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/createInvoiceForPayment.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-16T00:00:00Z | copilot | re-export invoice implementation for consistent types
 */

export type InvoiceResult = { invoiceNumber: number; pdfBuffer: Buffer; fileUrl?: string };

// Re-export the full implementation and types from the invoices submodule.
// NOTE: Must use explicit './invoices/index' path — TypeScript would otherwise
// resolve './invoices' back to this file itself (circular self-reference).
// Use `export type` for type-only re-exports to satisfy `isolatedModules`.
export type { InvoiceCreateOpts } from './invoices/index';
export { generateInvoicePdf, createInvoiceForPayment } from './invoices/index';
export { default } from './invoices/index';
