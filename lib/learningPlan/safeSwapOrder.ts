/**
 * FILE OBJECTIVE:
 * - Provide a helper to safely swap `orderInWeek` for two LearningPlanItem rows
 *   using a single SQL statement to avoid transient unique-constraint violations.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/learningPlan/safeSwapOrder.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-15T00:00:00Z | copilot | add safeSwapOrderInWeek helper to perform atomic swap via single UPDATE ... CASE
 */

import { type PrismaTx } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export type SafeSwapParams = {
  planId: string
  weekNumber: number
  srcId: string
  tgtId: string
  srcOrder: number
  tgtOrder: number
}

/**
 * Performs an atomic swap of orderInWeek between two items within the same plan/week.
 * Uses a single UPDATE ... CASE statement so the database computes final values
 * in one statement and avoids transient duplicates that can violate unique
 * constraints.
 */
export async function safeSwapOrderInWeek(
  tx: PrismaTx,
  params: SafeSwapParams,
): Promise<void> {
  try {
    await tx.$executeRaw`
      UPDATE "LearningPlanItem"
      SET "orderInWeek" = CASE
        WHEN "id" = ${params.srcId} THEN ${params.tgtOrder}
        WHEN "id" = ${params.tgtId} THEN ${params.srcOrder}
        ELSE "orderInWeek"
      END
      WHERE "planId" = ${params.planId}
        AND "weekNumber" = ${params.weekNumber}
        AND "id" IN (${params.srcId}, ${params.tgtId});
    `
  } catch (err) {
    logger.error('safeSwapOrderInWeek failed', { error: err, params })
    throw err
  }
}

const SAFE_SWAP_ORDER = { safeSwapOrderInWeek }
export default SAFE_SWAP_ORDER
