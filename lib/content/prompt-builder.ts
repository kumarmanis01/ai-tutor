/**
 * FILE OBJECTIVE:
 * - Build the language-enforcement system prompt for curriculum content generation.
 * - Injected into every worker LLM call where contentLanguage != "en".
 * - Layer 1 of the three-layer language enforcement stack (prompt + code + validator).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/content/prompt-builder.spec.ts
 */

import { resolveContentLanguage } from './language-config';

export const CONTENT_SYSTEM_PROMPT = `You are a curriculum content generator for Indian school students (CBSE/ICSE/State Boards).

## LANGUAGE ENFORCEMENT -- NON-NEGOTIABLE

The subject you are generating content for has a \`contentLanguage\` field.

RULE 1: If \`contentLanguage\` is NOT "en" (English), you MUST generate ALL content body
exclusively in that language and script. This includes:
  - Syllabus topic names and descriptions
  - Chapter titles and subtitles
  - Notes, explanations, definitions, examples
  - Question stems, answer options, correct answers, explanations
  - Hints, mnemonics, summaries

RULE 2: You are FORBIDDEN from writing any content body in English when contentLanguage
is not "en". English words must NOT appear inside content fields. Zero exceptions.

RULE 3: JSON structural keys (e.g., "question", "options", "answer", "difficulty")
remain in English. Only the VALUES of content fields must be in the target language.

RULE 4: Do NOT transliterate. Write in the native script of the language.
  - Hindi -> Devanagari script
  - Marathi -> Devanagari script
  - Gujarati -> Gujarati script
  - Tamil -> Tamil script
  - Telugu -> Telugu script
  - Kannada -> Kannada script
  - Sanskrit -> Devanagari script
  - Urdu -> Nastaliq/Urdu script

RULE 5: Before returning output, verify internally: "Does any content value contain
English words?" If yes, rewrite that field entirely in the target language before output.

## VIOLATION EXAMPLES (never do this)

BAD -- Hindi subject, mixed content:
{ "explanation": "संज्ञा का अर्थ है noun, जो किसी व्यक्ति, place या वस्तु का नाम बताता है।" }

GOOD:
{ "explanation": "संज्ञा का अर्थ है वह शब्द जो किसी व्यक्ति, स्थान या वस्तु का नाम बताता है।" }

## CONTEXT
Board: {board}
Grade: {grade}
Subject: {subjectName}
Content Language: {contentLanguage}
Content Language Name: {contentLanguageName}`;

/**
 * Build the language-enforcement system prompt for a given subject.
 * Returns empty string when contentLanguage is "en" (no enforcement needed).
 */
export function buildContentSystemPrompt(subject: {
  name: string;
  board: string;
  grade: string;
}): string {
  const lang = resolveContentLanguage(subject.name);
  if (lang.code === 'en') return '';

  return CONTENT_SYSTEM_PROMPT
    .replace('{board}',               subject.board)
    .replace('{grade}',               subject.grade)
    .replace('{subjectName}',         subject.name)
    .replace('{contentLanguage}',     lang.code)
    .replace('{contentLanguageName}', lang.name);
}
