/**
 * FILE OBJECTIVE:
 * - Prevent Prisma enum typing regressions that break VPS TypeScript pre-flight checks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/ai/prismaEnumCompatibility.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-26T09:10:00Z | copilot | add regression tests for Prisma enum compatibility and generation log promptType normalization
 * - 2026-04-26T09:15:00Z | copilot | simplify assertions to stable string enum values and remove brittle source scan check
 */

jest.mock('@/lib/prisma', () => ({
  prisma: {
    aIGenerationLog: {
      create: jest.fn().mockResolvedValue({ id: 'log_1' }),
    },
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import { prisma } from '@/lib/prisma';
import { generationLogService } from '@/lib/ai/generationLogService';

describe('Prisma enum compatibility', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps legacy string promptType values to valid Prisma PromptType enums', async () => {
    await generationLogService.logGeneration({
      promptType: 'notes',
      success: true,
    });

    expect(prisma.aIGenerationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptType: 'LESSON_GENERATION',
        }),
      })
    );
  });

  it('falls back unknown string promptType to CONTENT_ENHANCEMENT', async () => {
    await generationLogService.logGeneration({
      promptType: 'unknown_prompt_type',
      success: false,
      errorMessage: 'test',
    });

    expect(prisma.aIGenerationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptType: 'CONTENT_ENHANCEMENT',
        }),
      })
    );
  });
});
