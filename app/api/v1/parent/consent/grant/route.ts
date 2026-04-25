/**
 * FILE OBJECTIVE:
 * - V1 parent consent grant endpoint. Delegates to existing parent consent grant flow.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/parent/consent/grant/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created v1 parent consent grant endpoint
 */

import { POST as legacyPOST } from '@/app/api/parent/consent/grant/route';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return legacyPOST(req);
}
