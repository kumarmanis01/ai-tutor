/**
 * FILE OBJECTIVE:
 * - Alias reactivate endpoint for PATCH /api/v1/admin/invites/:id/reactivate.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/invites/reactivate/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T18:57:00Z | copilot | added reactivate alias to existing users reactivate handler
 */

import { POST as reactivateAdmin } from '@/app/api/v1/admin/users/[adminUserId]/reactivate/route';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  return reactivateAdmin(req, { params: Promise.resolve({ adminUserId: id }) });
}
