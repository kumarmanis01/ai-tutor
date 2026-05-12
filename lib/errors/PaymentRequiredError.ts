/**
 * FILE OBJECTIVE:
 * - DEPRECATED: No longer used. Payment required errors are now detected via statusCode on Error object.
 * - This file can be safely deleted.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/errors/PaymentRequiredError.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | created (now deprecated in favor of statusCode detection)
 * - 2026-05-12T00:00:00Z | copilot | marked as unused - can be deleted
 */

// Deprecated: See file objective above. Safe to delete.
// Error with 402 status is now detected via (error as any).statusCode === 402

