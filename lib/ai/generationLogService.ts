/**
 * FILE OBJECTIVE:
 * - Persist non-blocking AI generation observability logs with cost estimation in INR.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/generationLogService.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T15:00:00Z | copilot | created GenerationLogService and token-cost estimator for Sprint 7 logging
 * - 2026-04-26T08:03:49Z | copilot | use Prisma PromptType and InputJsonValue casts for aIGenerationLog.create worker build type checks
 * - 2026-04-26T08:03:49Z | copilot | switch PromptType to local enum and cast to Prisma namespace enum for DB writes
 * - 2026-04-26T09:10:00Z | copilot | replace Prisma.$Enums usage with direct PromptType import and normalize string prompt types for stable VPS typecheck
 * - 2026-04-26T09:35:00Z | copilot | type normalized promptType against Prisma AIGenerationLogCreateInput to satisfy worker build strictness
 */

import { Prisma } from '@prisma/client';
import { PromptType } from '@/lib/ai/prompt-registry/types';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { redactPIIFromText } from '@/lib/ai/piiRedaction';

const USD_TO_INR = 83;

interface ModelRate {
  inputPerMillionUsd: number;
  outputPerMillionUsd: number;
}

const MODEL_RATES: Record<string, ModelRate> = {
  'gpt-4o': { inputPerMillionUsd: 2.5, outputPerMillionUsd: 10 },
  'gpt-4o-mini': { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.6 },
};

export interface GenerationLogInput {
  promptType: PromptType | string;
  promptVersion?: string;
  abTestId?: string | null;
  abVariant?: string | null;
  requestVariables?: Record<string, unknown> | null;
  requestTokens?: number | null;
  responseText?: string | null;
  responseTokens?: number | null;
  totalTokens?: number | null;
  latencyMs?: number | null;
  modelName?: string | null;
  success: boolean;
  errorMessage?: string | null;
  retryCount?: number;
  qualityScore?: number | null;
  qualityDetails?: Record<string, unknown> | null;
  userId?: string | null;
  profileId?: string | null;
  contentId?: string | null;
  jobId?: string | null;
}

type PrismaPromptType = Prisma.AIGenerationLogCreateInput['promptType'];

function normalizePromptType(value: PromptType | string): PrismaPromptType {
  if (Object.values(PromptType).includes(value as PromptType)) {
    return value as unknown as PrismaPromptType;
  }

  const normalized = String(value).trim().toUpperCase();
  switch (normalized) {
    case 'LESSON_GENERATION':
    case 'NOTES':
      return PromptType.LESSON_GENERATION as unknown as PrismaPromptType;
    case 'PRACTICE_QUESTIONS':
    case 'PRACTICE':
    case 'QUESTIONS':
      return PromptType.PRACTICE_QUESTIONS as unknown as PrismaPromptType;
    case 'DOUBT_SOLVING':
    case 'DOUBTS':
    case 'CHAT':
      return PromptType.DOUBT_SOLVING as unknown as PrismaPromptType;
    case 'SIMPLE_EXPLANATION':
    case 'EXPLANATION':
      return PromptType.SIMPLE_EXPLANATION as unknown as PrismaPromptType;
    case 'CONTENT_TAGGING':
      return PromptType.CONTENT_TAGGING as unknown as PrismaPromptType;
    case 'DIAGNOSTIC_QUIZ':
      return PromptType.DIAGNOSTIC_QUIZ as unknown as PrismaPromptType;
    case 'PROGRESSIVE_HINTS':
      return PromptType.PROGRESSIVE_HINTS as unknown as PrismaPromptType;
    case 'WEEKLY_REPORT':
      return PromptType.WEEKLY_REPORT as unknown as PrismaPromptType;
    case 'CONTENT_ENHANCEMENT':
    default:
      return PromptType.CONTENT_ENHANCEMENT as unknown as PrismaPromptType;
  }
}

function sanitizeRequestVariables(
  variables?: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!variables) return null;

  const redactedKeys = new Set(['name', 'studentName', 'parentName', 'email', 'phone']);
  const sanitizedEntries = Object.entries(variables).map(([key, value]) => {
    if (redactedKeys.has(key)) return [key, '[REDACTED]'];
    if (typeof value === 'string') return [key, redactPIIFromText(value)];
    return [key, value];
  });

  return Object.fromEntries(sanitizedEntries);
}

export function estimateCostInr(
  modelName?: string | null,
  requestTokens?: number | null,
  responseTokens?: number | null
): number | null {
  if (!modelName) return null;

  const rate = MODEL_RATES[modelName] ?? MODEL_RATES[modelName.replace(/-latest$/i, '')];
  if (!rate) return null;

  const inTokens = Math.max(0, requestTokens ?? 0);
  const outTokens = Math.max(0, responseTokens ?? 0);

  const inputCostUsd = (inTokens / 1_000_000) * rate.inputPerMillionUsd;
  const outputCostUsd = (outTokens / 1_000_000) * rate.outputPerMillionUsd;

  const totalInr = (inputCostUsd + outputCostUsd) * USD_TO_INR;
  return Number(totalInr.toFixed(6));
}

export class GenerationLogService {
  async logGeneration(log: GenerationLogInput): Promise<void> {
    try {
      const estimatedCostInr = estimateCostInr(log.modelName, log.requestTokens, log.responseTokens);

      await prisma.aIGenerationLog.create({
        data: {
          promptType: normalizePromptType(log.promptType),
          promptVersion: log.promptVersion ?? 'unknown',
          abTestId: log.abTestId ?? null,
          abVariant: log.abVariant ?? null,
          requestVariables: (sanitizeRequestVariables(log.requestVariables) ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          requestTokens: log.requestTokens ?? null,
          responseText: log.responseText ? redactPIIFromText(log.responseText) : null,
          responseTokens: log.responseTokens ?? null,
          totalTokens: log.totalTokens ?? null,
          latencyMs: log.latencyMs ?? null,
          modelName: log.modelName ?? null,
          success: log.success,
          errorMessage: log.errorMessage ?? null,
          retryCount: log.retryCount ?? 0,
          qualityScore: log.qualityScore ?? null,
          qualityDetails: (log.qualityDetails ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          userId: log.userId ?? null,
          profileId: log.profileId ?? null,
          contentId: log.contentId ?? null,
          jobId: log.jobId ?? null,
          estimatedCostInr,
        },
      });
    } catch (error) {
      logger.warn('generation_log.create_failed', {
        promptType: log.promptType,
        promptVersion: log.promptVersion ?? 'unknown',
        error: String(error),
      });
    }
  }
}

export const generationLogService = new GenerationLogService();
