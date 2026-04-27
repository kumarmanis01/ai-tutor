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

import { normalizeDifficulty, normalizeLanguage } from "@/lib/normalize"
import { prisma } from "@/lib/prisma"

export async function personalizeContent(studentId: string) {
  const prefs = await prisma.studentContentPreference.findFirst({
    where: { studentId }
  })

  if (prefs) return

  await prisma.studentContentPreference.create({
    data: {
      studentId,
      difficulty: normalizeDifficulty("medium"),
      language: normalizeLanguage("en")
    }
  })
}
