/**
 * FILE OBJECTIVE:
 * - Admin prompt detail and draft update endpoint for prompt version records.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/prompts/[id]/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created prompt detail GET and draft-only PUT endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { logger } from '@/lib/logger';
import { promptService } from '@/lib/ai/prompt-registry';

export const dynamic = 'force-dynamic';

type RouteContext = { params: { id: string } };

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const guard = await requireActiveAdmin();
  if (!guard.ok) {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Active admin required' }, { status: 403 });
  }

  try {
    const prompt = await promptService.getPromptVersionById(params.id);
    if (!prompt) {
      return NextResponse.json({ code: 'NOT_FOUND', message: 'Prompt version not found' }, { status: 404 });
    }

    return NextResponse.json({ item: prompt });
  } catch (error) {
    logger.error('admin.prompts.get_by_id_failed', { id: params.id, error: String(error) });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to fetch prompt version' },
      { status: 500 }
    );
  }
}

interface UpdatePromptBody {
  systemPrompt?: string;
  userPromptTemplate?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
  changeNotes?: string;
}

export async function PUT(
  req: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  const guard = await requireActiveAdmin();
  if (!guard.ok) {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Active admin required' }, { status: 403 });
  }

  let body: UpdatePromptBody;
  try {
    body = (await req.json()) as UpdatePromptBody;
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid request body' }, { status: 400 });
  }

  try {
    const updated = await promptService.updateDraftPromptVersion(params.id, {
      systemPrompt: body.systemPrompt,
      userPromptTemplate: body.userPromptTemplate,
      modelName: body.modelName,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      changeNotes: body.changeNotes,
    });

    if (!updated) {
      return NextResponse.json(
        { code: 'CONFLICT', message: 'Only DRAFT prompt versions can be updated' },
        { status: 409 }
      );
    }

    return NextResponse.json({ item: updated });
  } catch (error) {
    logger.error('admin.prompts.update_failed', { id: params.id, error: String(error) });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to update prompt version' },
      { status: 500 }
    );
  }
}
