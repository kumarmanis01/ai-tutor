/**
 * Builds LLM prompts for on-demand quiz generation.
 *
 * Handles:
 * - Four quiz scopes: topic, chapter, subject, studied_so_far
 * - Language subject detection: injects grammar question categories for Hindi/English/Urdu/Sanskrit etc.
 * - Bilingual output: English or Hindi medium
 * - Difficulty calibration with NCERT-aligned descriptions
 */

import {
  detectLanguageSubject,
  splitQuestionCounts,
  grammarCategoryLabel,
  GrammarCategory,
} from './languageSubjectDetector';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';
export type QuizLanguage = 'en' | 'hi';

export interface TopicContext {
  name: string;
  chapterName?: string;
}

export interface OnDemandQuizPromptParams {
  topics: TopicContext[];
  subjectName: string;
  board: string;
  grade: number;
  difficulty: QuizDifficulty;
  language: QuizLanguage;
  totalQuestions: number;
  scopeLabel: string;
}

const DIFFICULTY_DESCRIPTIONS: Record<QuizDifficulty, string> = {
  easy: 'basic recall and direct comprehension -- no multi-step reasoning required',
  medium: 'application and moderate analysis -- student must apply a concept, not just recall',
  hard: 'evaluation and synthesis -- requires multi-step reasoning, comparison, or critical thinking',
};

const GRAMMAR_CATEGORY_DESCRIPTIONS: Record<GrammarCategory, string> = {
  tenses: 'identify or use correct verb tense (present/past/future, perfect, continuous)',
  parts_of_speech: 'identify noun/verb/adjective/adverb/pronoun/conjunction/preposition in a sentence',
  sentence_correction: 'spot and correct grammatical errors in a given sentence',
  punctuation_capitalisation: 'add correct punctuation or capitalisation to a sentence',
  vocabulary_meaning: 'choose the correct meaning, synonym, or antonym of an underlined word',
  fill_in_the_blank: 'fill in the blank with the grammatically correct word or phrase',
  active_passive: 'convert a sentence from active to passive voice or vice versa',
  direct_indirect_speech: 'convert direct speech to indirect or vice versa',
  comprehension: 'answer a factual or inferential question based on a short passage',
  idioms_phrases: 'identify the correct meaning of an idiom or phrase in context',
  sandhi_samas: 'identify or split a Sandhi or Samas in Hindi/Sanskrit',
  ras_chhand_alankar: 'identify Ras, Chhand, or Alankar in a given verse or sentence',
  karak_vibhakti: 'identify the Karak or correct Vibhakti form in a Hindi/Sanskrit sentence',
  upsarg_pratyay: 'identify the Upsarg or Pratyay in a Hindi/Sanskrit word',
};

function buildTopicList(topics: TopicContext[]): string {
  if (topics.length === 1) {
    const t = topics[0];
    return t.chapterName ? `"${t.name}" (from chapter "${t.chapterName}")` : `"${t.name}"`;
  }
  const lines = topics
    .slice(0, 20)
    .map((t, i) => {
      const suffix = t.chapterName ? ` (chapter: ${t.chapterName})` : '';
      return `  ${i + 1}. ${t.name}${suffix}`;
    })
    .join('\n');
  const extra = topics.length > 20 ? `\n  ... and ${topics.length - 20} more topics` : '';
  return `the following topics:\n${lines}${extra}`;
}

function buildGrammarBlock(
  grammarCategories: GrammarCategory[],
  grammarCount: number,
  language: string
): string {
  const subset = grammarCategories.slice(0, 6);
  const catLines = subset
    .map((c) => `    - ${grammarCategoryLabel(c)}: ${GRAMMAR_CATEGORY_DESCRIPTIONS[c]}`)
    .join('\n');
  return `
GRAMMAR QUESTIONS (exactly ${grammarCount} of the ${grammarCount} grammar slots):
  These must test ${language} grammar directly. Rotate across these categories:
${catLines}
  Rules for grammar questions:
  - Sentence used as context MUST be original (not copied from any published work).
  - Correct answer must be unambiguous.
  - Distractor options must reflect common student mistakes (not random words).
  - Tag each grammar question with: "grammarCategory": "<category_key>" in the JSON.`;
}

export function buildOnDemandQuizPrompt(params: OnDemandQuizPromptParams): string {
  const {
    topics,
    subjectName,
    board,
    grade,
    difficulty,
    language,
    totalQuestions,
    scopeLabel,
  } = params;

  const langLabel = language === 'hi' ? 'Hindi' : 'English';
  const topicList = buildTopicList(topics);
  const diffDesc = DIFFICULTY_DESCRIPTIONS[difficulty];

  const langInfo = detectLanguageSubject(subjectName);
  const { grammarCount, contentCount } = splitQuestionCounts(
    totalQuestions,
    langInfo.grammarRatio
  );

  const grammarBlock =
    langInfo.isLanguage && grammarCount > 0 && langInfo.language
      ? buildGrammarBlock(langInfo.grammarCategories, grammarCount, langInfo.language)
      : '';

  const questionDistribution =
    langInfo.isLanguage && grammarCount > 0
      ? `  - ${contentCount} content questions (testing concepts from the topics listed)
  - ${grammarCount} grammar questions (testing ${langInfo.language} language rules)`
      : `  - ${totalQuestions} content questions covering the topics listed`;

  return `You are an expert question writer for Indian school students (${board}, Grade ${grade}).
Subject: ${subjectName}
Scope: ${scopeLabel}
Topics covered: ${topicList}

TASK: Generate exactly ${totalQuestions} multiple-choice questions in ${langLabel}.

DIFFICULTY: ${difficulty} -- ${diffDesc}.
All ${totalQuestions} questions MUST be ${difficulty} level.

QUESTION DISTRIBUTION:
${questionDistribution}

STRICT OUTPUT RULES:
1. Return ONLY valid JSON -- no markdown fences, no backticks, no commentary before or after.
2. Each question MUST have exactly 4 options.
3. "correctAnswer" MUST be the exact string of one option (not an index).
4. "explanation" must be 1-2 concise sentences (max 80 words) stating WHY the answer is correct.
5. "difficulty" field on each question must be "${difficulty}".
6. Questions must be age-appropriate for Grade ${grade}.
7. Distractors must be plausible -- at least one should reflect a common student misconception.
8. Do NOT repeat the same question concept twice.
9. Questions must test ONLY syllabus content for ${board} Grade ${grade} ${subjectName}.
${grammarBlock}
REQUIRED JSON FORMAT:
{
  "questions": [
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": "string",
      "explanation": "string",
      "difficulty": "${difficulty}",
      "topicName": "string",
      "grammarCategory": "string or null"
    }
  ]
}

Return ONLY the JSON object with exactly ${totalQuestions} questions. No other text.`;
}
