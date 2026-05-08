/**
 * FILE OBJECTIVE:
 * - Provide a shared server-side service to consume and refund daily free-question quota.
 * - Keep quota mutations centralized so all ask endpoints enforce the same policy.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/freeQuestionQuota.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-08T00:00:00Z | copilot | extract shared consume/refund service for daily free-question quota
 */

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { isPremiumUser } from '@/lib/subscription';
import { DAILY_FREE_QUESTION_LIMIT } from '@/lib/constants/freeTier';
import { checkFreeTierCap, incrementFreeTierUsage } from '@/lib/freemium';

const SESSION_SCOPE = '__ALL__';

type QuotaMethod = 'column' | 'freemium' | 'premium';

export type ConsumeDailyFreeQuestionQuotaResult =
  | {
      status: 'ok';
      isPremium: boolean;
      charged: boolean;
      remaining: number | null;
      method: QuotaMethod;
    }
  | { status: 'not_found' }
  | { status: 'limit_reached' };

function isMissingFreeQuestionColumnError(error: unknown): boolean {
  const err = error as { code?: string; message?: unknown };
  const message = String(err?.message ?? '');
  return err?.code === 'P2022' && message.includes('todaysFreeQuestionsCount');
}

function getCurrentPeriodStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Atomically consume one free-question unit for a student when applicable.
 */
export async function consumeDailyFreeQuestionQuota(studentId: string): Promise<ConsumeDailyFreeQuestionQuotaResult> {
  if (await isPremiumUser(studentId)) {
    return {
      status: 'ok',
      isPremium: true,
      charged: false,
      remaining: null,
      method: 'premium',
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: studentId } });
      if (!user) return { status: 'not_found' } as const;

      if ((user.todaysFreeQuestionsCount ?? DAILY_FREE_QUESTION_LIMIT) <= 0) {
        return { status: 'limit_reached' } as const;
      }

      const updated = await tx.user.update({
        where: { id: studentId },
        data: { todaysFreeQuestionsCount: { decrement: 1 } },
      });

      return {
        status: 'ok',
        isPremium: false,
        charged: true,
        remaining: updated.todaysFreeQuestionsCount,
        method: 'column',
      } as const;
    });

    return result;
  } catch (error) {
    if (!isMissingFreeQuestionColumnError(error)) throw error;

    const status = await checkFreeTierCap(studentId);
    if (!status.allowed) {
      return { status: 'limit_reached' };
    }

    await incrementFreeTierUsage(studentId);

    return {
      status: 'ok',
      isPremium: false,
      charged: true,
      remaining: Math.max(0, status.sessionsRemaining - 1),
      method: 'freemium',
    };
  }
}

/**
 * Best-effort refund of one consumed unit when a downstream doubt generation fails.
 */
export async function refundDailyFreeQuestionQuota(studentId: string, method: Exclude<QuotaMethod, 'premium'>): Promise<void> {
  try {
    if (method === 'column') {
      await prisma.user.update({
        where: { id: studentId },
        data: { todaysFreeQuestionsCount: { increment: 1 } },
      });
      return;
    }

    await prisma.$transaction(async (tx) => {
      const usage = await tx.freeTierUsage.findFirst({
        where: {
          studentId,
          subjectScope: SESSION_SCOPE,
          periodStart: getCurrentPeriodStart(),
        },
      });

      if (!usage) return;

      await tx.freeTierUsage.update({
        where: { id: usage.id },
        data: {
          sessionsUsed: Math.max(0, usage.sessionsUsed - 1),
        },
      });
    });
  } catch (error) {
    logger.warn('freeQuestionQuota refund failed', {
      className: 'lib.freeQuestionQuota',
      methodName: 'refundDailyFreeQuestionQuota',
      studentId,
      method,
      error,
    });
  }
}
