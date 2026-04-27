/**
 * FILE OBJECTIVE:
 * - Admin endpoint to activate a prompt version and deactivate prior active one.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/prompts/[id]/activate/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created prompt activate endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { logger } from '@/lib/logger';
import { promptService } from '@/lib/ai/prompt-registry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function POST(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const guard = await requireActiveAdmin();
  if (!guard.ok) {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Active admin required' }, { status: 403 });
  }

  try {
    const activated = await promptService.activatePromptVersion(params.id);
    if (!activated) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Prompt version not found' }, { status: 404 });
    }
    return NextResponse.json({ item: activated });
  } catch (error) {
    logger.error('admin.prompts.activate_failed', { id: params.id, error: String(error) });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to activate prompt version' },
      { status: 500 }
    );
  }
}
