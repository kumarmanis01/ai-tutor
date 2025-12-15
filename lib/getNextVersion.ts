/**
 * PRISMA RULE:
 * - NEVER pass null into `where` clauses
 * - Conditionally OMIT fields using spread
 * - Do NOT redefine Prisma enums locally
 * 
 * REquired Pattern
 * const last = await prisma.topicNote.findFirst({
 *   where: {
 *     topicId,
 *     language: language ?? undefined,
 *   },
 *   orderBy: { version: "desc" },
 * });
 * 
 * return (last?.version ?? 0) + 1;
 */

import { prisma } from "@/lib/prisma"
import { normalizeLanguage, normalizeDifficulty } from "@/lib/normalize";

export async function getNextVersion(params: {
  topicId: string
  difficulty?: string
  language?: string
  type: "note" | "test"
}) {
  if (params.type === "note") {
    const latest = await prisma.topicNote.findFirst({
      where: {
        topicId: params.topicId,
        language: normalizeLanguage(params.language)
      },
      orderBy: { version: "desc" }
    })
    return latest ? latest.version + 1 : 1
  }

  const latest = await prisma.generatedTest.findFirst({
    where: {
      topicId: params.topicId,
      difficulty: normalizeDifficulty(params.difficulty),
      language: normalizeLanguage(params.language)
    },
    orderBy: { version: "desc" }
  })

  return latest ? latest.version + 1 : 1
}
