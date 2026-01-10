/**
 * COPILOT RULES — NORMALIZATION
 *
 * - Input may be unsafe
 * - Output MUST be Prisma enums
 * - Never return raw strings
 * 
 * Correct Pattern
 * import { LanguageCode } from "@prisma/client";
 * export function normalizeLanguage(
 *   lang?: string
 * ): LanguageCode | undefined {
 *   if (!lang) return undefined;
 * 
 *   switch (lang.toLowerCase()) {
 *     case "hi":
 *     case "hindi":
 *       return LanguageCode.hi;
 *     default:
 *       return LanguageCode.en;
 *   }
 * }

 */

import { LanguageCode, DifficultyLevel, JobType } from '@prisma/client'

export function normalizeLanguage(lang?: string): LanguageCode {
  if (!lang) return LanguageCode.en

  switch (lang.toLowerCase()) {
    case 'hi':
    case 'hindi':
      return LanguageCode.hi
    case 'en':
    case 'english':
      return LanguageCode.en
    default:
      return LanguageCode.en
  }
}

export function normalizeDifficulty(diff?: string): DifficultyLevel {
  if (!diff) return DifficultyLevel.medium

  switch (diff.toLowerCase()) {
    case 'easy':
      return DifficultyLevel.easy
    case 'hard':
      return DifficultyLevel.hard
    case 'medium':
      return DifficultyLevel.medium
    default:
      return DifficultyLevel.medium
  }
}

export function normalizeJobType(jobType?: string): JobType {
  if (!jobType) throw new Error('jobType is required')

  const key = jobType.trim().toLowerCase()

  if (key.includes('note')) return JobType.notes
  if (key.includes('question')) return JobType.questions
  if (key.includes('test') && !key.includes('contest')) return JobType.tests
  if (key.includes('sylla') || key === 'syllabus') return JobType.syllabus
  if (key.includes('assemble')) return JobType.assemble

  // If the key matches a JobType value directly, coerce it
  if ((Object.values(JobType) as string[]).includes(key)) return key as JobType

  throw new Error(`Unknown jobType: ${jobType}`)
}
