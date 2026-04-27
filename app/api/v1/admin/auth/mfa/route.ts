/**
 * FILE OBJECTIVE:
 * - Alias endpoint for admin MFA verification at POST /api/v1/admin/auth/mfa.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/auth/mfa/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T18:55:00Z | copilot | added A0.3 MFA alias endpoint delegating to /login/verify-mfa
 */

import { POST as verifyMfa } from '@/app/api/v1/admin/auth/login/verify-mfa/route';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return verifyMfa(req);
}
