/**
 * FILE OBJECTIVE:
 * - Admin endpoint to deprecate a prompt version and invalidate prompt cache.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/prompts/[id]/deprecate/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created prompt deprecate endpoint
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
    const deprecated = await promptService.deprecatePromptVersion(params.id);
    if (!deprecated) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Prompt version not found' }, { status: 404 });
    }
    return NextResponse.json({ item: deprecated });
  } catch (error) {
    logger.error('admin.prompts.deprecate_failed', { id: params.id, error: String(error) });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to deprecate prompt version' },
      { status: 500 }
    );
  }
}
