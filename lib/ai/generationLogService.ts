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
 */

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
  promptType: string;
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
          promptType: log.promptType,
          promptVersion: log.promptVersion ?? 'unknown',
          abTestId: log.abTestId ?? null,
          abVariant: log.abVariant ?? null,
          requestVariables: sanitizeRequestVariables(log.requestVariables),
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
          qualityDetails: log.qualityDetails ?? null,
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
