/**
 * Detects whether a subject is a language subject (Hindi, English, Urdu, Sanskrit, etc.)
 * and returns the grammar question categories to inject into quiz generation.
 *
 * Language subjects receive ~35% grammar questions in addition to content questions.
 * Grammar categories are tailored per language to match NCERT/CBSE/ICSE syllabus expectations.
 */

export type GrammarCategory =
  | 'tenses'
  | 'parts_of_speech'
  | 'sentence_correction'
  | 'punctuation_capitalisation'
  | 'vocabulary_meaning'
  | 'fill_in_the_blank'
  | 'active_passive'
  | 'direct_indirect_speech'
  | 'comprehension'
  | 'idioms_phrases'
  | 'sandhi_samas'
  | 'ras_chhand_alankar'
  | 'karak_vibhakti'
  | 'upsarg_pratyay';

export interface LanguageSubjectInfo {
  isLanguage: boolean;
  /** Normalised language name, e.g. "Hindi", "English". Null for non-language subjects. */
  language: string | null;
  grammarCategories: GrammarCategory[];
  /** Fraction of total questions that should be grammar-focused (0.0-1.0). */
  grammarRatio: number;
}

export interface QuestionCountSplit {
  grammarCount: number;
  contentCount: number;
}

const LANGUAGE_SUBJECT_KEYWORDS: string[] = [
  'hindi',
  'english',
  'urdu',
  'sanskrit',
  'bengali',
  'marathi',
  'tamil',
  'telugu',
  'gujarati',
  'punjabi',
  'malayalam',
  'kannada',
  'odia',
  'assamese',
  'french',
  'german',
  'spanish',
];

const GRAMMAR_CATEGORIES: Record<string, GrammarCategory[]> = {
  hindi: [
    'tenses',
    'parts_of_speech',
    'sentence_correction',
    'fill_in_the_blank',
    'vocabulary_meaning',
    'active_passive',
    'direct_indirect_speech',
    'idioms_phrases',
    'sandhi_samas',
    'ras_chhand_alankar',
    'karak_vibhakti',
    'upsarg_pratyay',
  ],
  urdu: [
    'tenses',
    'parts_of_speech',
    'sentence_correction',
    'fill_in_the_blank',
    'vocabulary_meaning',
    'idioms_phrases',
    'active_passive',
  ],
  sanskrit: [
    'parts_of_speech',
    'sentence_correction',
    'vocabulary_meaning',
    'fill_in_the_blank',
    'sandhi_samas',
    'karak_vibhakti',
    'upsarg_pratyay',
  ],
  english: [
    'tenses',
    'parts_of_speech',
    'sentence_correction',
    'punctuation_capitalisation',
    'vocabulary_meaning',
    'fill_in_the_blank',
    'active_passive',
    'direct_indirect_speech',
    'comprehension',
    'idioms_phrases',
  ],
  marathi: [
    'tenses',
    'parts_of_speech',
    'sentence_correction',
    'fill_in_the_blank',
    'vocabulary_meaning',
    'sandhi_samas',
    'karak_vibhakti',
  ],
  bengali: [
    'tenses',
    'parts_of_speech',
    'sentence_correction',
    'fill_in_the_blank',
    'vocabulary_meaning',
    'idioms_phrases',
  ],
};

const FALLBACK_GRAMMAR_CATEGORIES: GrammarCategory[] = [
  'tenses',
  'parts_of_speech',
  'sentence_correction',
  'vocabulary_meaning',
  'fill_in_the_blank',
];

/** Fraction of questions that should be grammar for any language subject. */
const GRAMMAR_RATIO = 0.35;

export function detectLanguageSubject(subjectName: string): LanguageSubjectInfo {
  const lower = (subjectName ?? '').toLowerCase().trim();

  const matched = LANGUAGE_SUBJECT_KEYWORDS.find((kw) => lower.includes(kw));

  if (!matched) {
    return { isLanguage: false, language: null, grammarCategories: [], grammarRatio: 0 };
  }

  const categories = GRAMMAR_CATEGORIES[matched] ?? FALLBACK_GRAMMAR_CATEGORIES;
  const label = matched.charAt(0).toUpperCase() + matched.slice(1);

  return {
    isLanguage: true,
    language: label,
    grammarCategories: categories,
    grammarRatio: GRAMMAR_RATIO,
  };
}

/**
 * Splits a total question count into grammar and content buckets.
 * Grammar count is always at least 1 when ratio > 0 and total >= 2.
 */
export function splitQuestionCounts(
  total: number,
  grammarRatio: number
): QuestionCountSplit {
  if (grammarRatio <= 0 || total < 2) {
    return { grammarCount: 0, contentCount: total };
  }
  const grammarCount = Math.max(1, Math.round(total * grammarRatio));
  return { grammarCount, contentCount: Math.max(1, total - grammarCount) };
}

/** Human-readable label for a grammar category. */
export function grammarCategoryLabel(cat: GrammarCategory): string {
  const LABELS: Record<GrammarCategory, string> = {
    tenses: 'Tenses',
    parts_of_speech: 'Parts of Speech',
    sentence_correction: 'Sentence Correction',
    punctuation_capitalisation: 'Punctuation & Capitalisation',
    vocabulary_meaning: 'Vocabulary & Word Meanings',
    fill_in_the_blank: 'Fill in the Blank',
    active_passive: 'Active & Passive Voice',
    direct_indirect_speech: 'Direct & Indirect Speech',
    comprehension: 'Reading Comprehension',
    idioms_phrases: 'Idioms & Phrases',
    sandhi_samas: 'Sandhi & Samas',
    ras_chhand_alankar: 'Ras, Chhand & Alankar',
    karak_vibhakti: 'Karak & Vibhakti',
    upsarg_pratyay: 'Upsarg & Pratyay',
  };
  return LABELS[cat] ?? cat;
}
