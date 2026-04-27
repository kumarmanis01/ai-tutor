/**
 * FILE OBJECTIVE:
 * - Alias suspend endpoint for PATCH /api/v1/admin/invites/:id/suspend.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/invites/suspend/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T18:57:00Z | copilot | added suspend alias to existing users suspend handler
 */

import { POST as suspendAdmin } from '@/app/api/v1/admin/users/[adminUserId]/suspend/route';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  return suspendAdmin(req, { params: Promise.resolve({ adminUserId: id }) });
}
