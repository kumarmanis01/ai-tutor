/**
 * FILE OBJECTIVE:
 * - Alias resend endpoint for POST /api/v1/admin/invites/:id/resend.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/invites/resend/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T18:57:00Z | copilot | added resend alias to existing users resend handler
 */

import { POST as resendInvite } from '@/app/api/v1/admin/users/[adminUserId]/resend/route';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Params): Promise<Response> {
  const { id } = await params;
  return resendInvite(req, { params: Promise.resolve({ adminUserId: id }) });
}
