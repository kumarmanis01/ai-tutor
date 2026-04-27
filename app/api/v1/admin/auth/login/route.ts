/**
 * FILE OBJECTIVE:
 * - Alias endpoint for admin login step 1 at POST /api/v1/admin/auth/login.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/auth/login/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T18:55:00Z | copilot | added A0.3 login alias endpoint delegating to /login/start
 */

import { POST as startLogin } from '@/app/api/v1/admin/auth/login/start/route';

export const dynamic = 'force-dynamic';

export async function POST(req: Request): Promise<Response> {
  return startLogin(req);
}
