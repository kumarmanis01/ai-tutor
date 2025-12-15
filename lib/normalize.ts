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

import { LanguageCode, DifficultyLevel } from "@prisma/client";

export function normalizeLanguage(lang?: string): LanguageCode {
  if (!lang) return LanguageCode.en;

  switch (lang.toLowerCase()) {
    case "hi":
    case "hindi":
      return LanguageCode.hi;
    case "en":
    case "english":
      return LanguageCode.en;
    default:
      return LanguageCode.en;
  }
}

export function normalizeDifficulty(diff?: string): DifficultyLevel {
  if (!diff) return DifficultyLevel.medium;

  switch (diff.toLowerCase()) {
    case "easy":
      return DifficultyLevel.easy;
    case "hard":
      return DifficultyLevel.hard;
    case "medium":
      return DifficultyLevel.medium;
    default:
      return DifficultyLevel.medium;
  }
}
