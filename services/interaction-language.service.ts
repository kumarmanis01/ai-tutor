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
 * - 2026-05-27 | claude | removed @prisma/client import -- Prisma 7 enum
 *     duplicate declarations cause TS2614; use string literal 'LANGUAGE'
 *     which is always the runtime value of the enum.
 */

/** Narrow type for subjects passed to this service. Avoids importing Prisma enums. */
export interface SubjectForLanguage {
  subjectType: string;
  targetLanguage: string | null;
}

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
  subject: Pick<SubjectForLanguage, 'subjectType' | 'targetLanguage'>,
  studentUiLocale: string,
): string {
  if (subject.subjectType === 'LANGUAGE' && subject.targetLanguage) {
    return subject.targetLanguage;
  }
  return studentUiLocale;
}

export function isLanguageSubject(subject: Pick<SubjectForLanguage, 'subjectType'>): boolean {
  return subject.subjectType === 'LANGUAGE';
}

const ISO_TO_LANGUAGE_NAME: Record<string, string> = {
  hi: 'Hindi', sa: 'Sanskrit', fr: 'French', de: 'German', es: 'Spanish',
  ur: 'Urdu', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', ml: 'Malayalam',
  bn: 'Bengali', mr: 'Marathi', gu: 'Gujarati', pa: 'Punjabi', or: 'Odia',
  as: 'Assamese', mai: 'Maithili', sd: 'Sindhi', kok: 'Konkani',
  ar: 'Arabic', ja: 'Japanese', zh: 'Chinese', ru: 'Russian', en: 'English',
};

export function isoToLanguageName(code: string): string {
  return ISO_TO_LANGUAGE_NAME[code] ?? code;
}

/**
 * Build the mandatory immersion directive injected into AI prompts for LANGUAGE subjects.
 * Use as the first instruction layer -- never truncated, never optional.
 */
export function buildLanguageImmersionDirective(subjectName: string, isoCode: string): string {
  const langName = isoToLanguageName(isoCode);
  return `CRITICAL LANGUAGE INSTRUCTION -- ${langName.toUpperCase()} IMMERSION:
This is a ${subjectName} class. The student is learning ${langName} as a subject.
Generate ALL content EXCLUSIVELY in ${langName} (ISO 639-1: ${isoCode}).
This applies to: questions, options, answers, explanations, hints, and feedback.
Do NOT use English anywhere -- not in question text, not in options, not in hints.
The immersion is mandatory. Mixing in English defeats the pedagogical purpose.`;
}
