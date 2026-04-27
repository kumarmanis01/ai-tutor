/**
 * FILE OBJECTIVE:
 * - Alias invites endpoint for GET/POST at /api/v1/admin/invites.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/invites/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T18:55:00Z | copilot | added A0.1 invites alias endpoint delegating to /admin/users
 */

import { GET as getUsers, POST as postInvite } from '@/app/api/v1/admin/users/route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request): Promise<Response> {
  return getUsers(req);
}

export async function POST(req: Request): Promise<Response> {
  return postInvite(req);
}
