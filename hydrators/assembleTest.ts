/**
 * COPILOT RULES — HYDRATOR
 *
 * - Hydrators only enqueue jobs
 * - No AI calls allowed here
 * - Must be idempotent
 * - Must check DB before enqueue
 * - Never mutate existing content
 * example
 * await prisma.hydrationJob.upsert({
 *  where: { jobType_unique },
 *   update: {},
 *   create: {
 *     jobType: "notes",
 *     topicId,
 *     language,
 *   },
 * });
 */

import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

const HYDRATION_DEBUG = process.env.HYDRATION_DEBUG === '1' || process.env.AI_CONTENT_DEBUG === '1'

export async function assembleTest(topicId: string) {
  if (HYDRATION_DEBUG) logger.debug('[hydration][DEBUG] assembleTest called', { topicId })

  const drafts = await prisma.generatedTest.findMany({
    where: {
      topicId,
      status: "draft"
    },
    include: { questions: true }
  })

  for (const test of drafts) {
    if (test.questions.length < 5) continue

    await prisma.generatedTest.update({
      where: { id: test.id },
      data: {
        status: "approved"
      }
    })
  }
}
