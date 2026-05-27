/**
 * FILE OBJECTIVE:
 * - Single source of truth for resolving which language the AI tutor
 *   speaks during a session.
 * - LANGUAGE subjects are taught exclusively in their target language.
 * - All other subjects use the student's UI locale.
 *
 * LINKED UNIT TEST:
 * - tests/unit/services/interaction-language.service.test.ts
 *
 * EDIT LOG:
 * - 2026-05-27 | claude | created for subject-aware interaction language
 */

import { SubjectType } from '@prisma/client';

/**
 * Resolve the language the AI tutor should use for this session.
 *
 * For LANGUAGE subjects: always the subject's target language (ISO 639-1 code),
 * regardless of the student's UI locale.
 * For all other subjects: the student's UI locale.
 *
 * This is the only place this logic should live. Never resolve inline.
 */
export function resolveInteractionLanguage(
  subject: Pick<{ subjectType: SubjectType; targetLanguage: string | null }, 'subjectType' | 'targetLanguage'>,
  studentUiLocale: string,
): string {
  if (subject.subjectType === SubjectType.LANGUAGE && subject.targetLanguage) {
    return subject.targetLanguage;
  }
  return studentUiLocale;
}

export function isLanguageSubject(subject: Pick<{ subjectType: SubjectType }, 'subjectType'>): boolean {
  return subject.subjectType === SubjectType.LANGUAGE;
}
