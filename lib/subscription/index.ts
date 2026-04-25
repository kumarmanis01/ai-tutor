/**
 * FILE OBJECTIVE:
 * - Compatibility shim: re-export legacy `lib/subscription` helpers from
 *   the new `lib/billing` location to avoid breaking imports after refactor.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/subscription.spec.ts (references updated path)
 *
 * EDIT LOG:
 * - 2026-04-15T00:30:00Z | copilot | add compatibility shim re-exporting billing helpers
 */

export { isPremiumUser, getTodaysQuestionCount } from '@/lib/billing/subscription';

// Default export kept for modules that import the module as a default object
import * as _all from '@/lib/billing/subscription';
export default _all;
