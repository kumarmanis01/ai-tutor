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

export async function assembleTest(topicId: string) {
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
