/**
 * FILE OBJECTIVE:
 * - Admin prompt management list/create endpoint for DB-backed prompt versioning.
 * - Implements PR-1.2: GET/POST endpoints for prompt CRUD operations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/admin/prompts/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created GET/POST prompt admin endpoint for Sprint 7
 * - 2026-04-26T15:30:00Z | staff-engineer | integrated PromptService and PromptVariableValidator (PR-1.2, PR-1.3)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { logger } from '@/lib/logger';
import { PromptService } from '@/lib/ai/prompts/service';
import { PromptVariableValidator } from '@/lib/ai/prompts/validator';
import { PromptStatus, PromptType } from '@prisma/client';

export const dynamic = 'force-dynamic';

function isPromptType(value?: string | null): value is PromptType {
  return Boolean(value) && Object.values(PromptType).includes(value as PromptType);
}

function isPromptStatus(value?: string | null): value is PromptStatus {
  return Boolean(value) && Object.values(PromptStatus).includes(value as PromptStatus);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const guard = await requireActiveAdmin();
  if (!guard.ok) {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Active admin required' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const typeParam = url.searchParams.get('type');
    const statusParam = url.searchParams.get('status');

    if (typeParam && !isPromptType(typeParam)) {
      return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid prompt type' }, { status: 400 });
    }
    if (statusParam && !isPromptStatus(statusParam)) {
      return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid prompt status' }, { status: 400 });
    }

    const prompts = await PromptService.listPrompts({
      type: typeParam as PromptType | undefined,
      status: statusParam as PromptStatus | undefined,
    });

    return NextResponse.json({ data: prompts, count: prompts.length }, { status: 200 });
  } catch (error) {
    logger.error('admin.prompts.list_failed', { error: String(error) });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to list prompts' },
      { status: 500 }
    );
  }
}

interface CreatePromptBody {
  promptType?: PromptType;
  version?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
  changeNotes?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const guard = await requireActiveAdmin();
  if (!guard.ok || !guard.userId) {
    return NextResponse.json({ code: 'FORBIDDEN', message: 'Active admin required' }, { status: 403 });
  }

  let body: CreatePromptBody;
  try {
    body = (await req.json()) as CreatePromptBody;
  } catch {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'Invalid request body' }, { status: 400 });
  }

  if (!body.promptType || !isPromptType(body.promptType)) {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'promptType is required' }, { status: 400 });
  }
  if (!body.version || typeof body.version !== 'string') {
    return NextResponse.json({ code: 'BAD_REQUEST', message: 'version is required' }, { status: 400 });
  }
  if (!body.systemPrompt || !body.userPromptTemplate || !body.modelName) {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'systemPrompt, userPromptTemplate, and modelName are required' },
      { status: 400 }
    );
  }
  if (typeof body.maxTokens !== 'number' || typeof body.temperature !== 'number') {
    return NextResponse.json(
      { code: 'BAD_REQUEST', message: 'maxTokens and temperature are required numbers' },
      { status: 400 }
    );
  }

  // PR-1.3: Validate template variables match schema
  const templateValidation = PromptVariableValidator.validateTemplateVariables(
    body.promptType,
    body.userPromptTemplate
  );

  if (!templateValidation.valid) {
    return NextResponse.json(
      {
        code: 'INVALID_TEMPLATE',
        message: 'Template variables do not match schema',
        missingVars: templateValidation.missingVars,
        unknownVars: templateValidation.unknownVars,
      },
      { status: 400 }
    );
  }

  try {
    const created = await PromptService.createDraftPrompt({
      promptType: body.promptType,
      version: body.version,
      systemPrompt: body.systemPrompt,
      userPromptTemplate: body.userPromptTemplate,
      modelName: body.modelName,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      changeNotes: body.changeNotes,
      createdBy: guard.userId,
    });

    logger.info('Prompt version created', {
      promptType: body.promptType,
      version: body.version,
      id: created.id,
    });

    return NextResponse.json(
      { data: created, message: 'Prompt version created as DRAFT' },
      { status: 201 }
    );
  } catch (error) {
    logger.error('admin.prompts.create_failed', { error: String(error), promptType: body.promptType });
    return NextResponse.json(
      { code: 'INTERNAL_ERROR', message: 'Failed to create prompt version' },
      { status: 500 }
    );
  }
}
