/**
 * FILE OBJECTIVE:
 * - V1 parent children creation endpoint. Delegates to existing parent create-child flow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/parent/children/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 parent children endpoint
 */

import { POST as legacyPOST } from '@/app/api/parent/create-child/route';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return legacyPOST(req);
}
