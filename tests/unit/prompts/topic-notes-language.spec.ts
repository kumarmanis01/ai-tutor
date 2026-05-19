/**
 * FILE OBJECTIVE:
 * - Unit tests for language subject support in prompts/topic-notes.ts
 * - Verifies: grammar section injection, grammarNotes schema block,
 *   board-specific quality requirements, and that STEM subjects are
 *   unaffected by language extensions.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: tests/unit/prompts/topic-notes-language.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created language notes prompt tests
 */

import { topicNotesPrompt } from '@/prompts/topic-notes'

const BASE_PARAMS = {
  topicName: 'A Letter to God',
  grade: 10,
  board: 'CBSE',
  subject: 'English',
  chapter: 'First Flight',
  difficultyLevel: 'standard' as const,
}

const GRAMMAR_LANGUAGE_META = {
  language: 'English',
  topicCategory: 'grammar' as const,
  grammarDomain: 'active_passive_voice',
  grammarLabel: 'Active and Passive Voice',
  grammarDescription: 'Transformation between active and passive voice across all tenses.',
  examPatterns: ['change to passive voice', 'rewrite as directed'],
  nuances: ['Intransitive verbs have no passive form.'],
}

const PROSE_LANGUAGE_META = {
  language: 'English',
  topicCategory: 'prose' as const,
  grammarDomain: 'tenses_perfect',
  grammarLabel: 'Perfect Tenses',
  grammarDescription: 'Present perfect, past perfect and their use.',
  examPatterns: ['fill in with correct perfect tense'],
  nuances: ["Present perfect with 'since' (point in time) vs. 'for' (duration)."],
}

describe('topicNotesPrompt -- language subject (grammar primary)', () => {
  it('should include LANGUAGE SUBJECT -- GRAMMAR NOTES REQUIRED section', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: GRAMMAR_LANGUAGE_META })
    expect(prompt).toContain('LANGUAGE SUBJECT -- GRAMMAR NOTES REQUIRED')
  })

  it('should include the grammar domain name', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: GRAMMAR_LANGUAGE_META })
    expect(prompt).toContain('Active and Passive Voice')
  })

  it('should include exam patterns from languageMeta', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: GRAMMAR_LANGUAGE_META })
    expect(prompt).toContain('change to passive voice')
  })

  it('should include language-specific nuances', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: GRAMMAR_LANGUAGE_META })
    expect(prompt).toContain('Intransitive verbs have no passive form')
  })

  it('should include grammarNotes in the JSON schema block', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: GRAMMAR_LANGUAGE_META })
    expect(prompt).toContain('"grammarNotes"')
    expect(prompt).toContain('"chapterAnchor"')
    expect(prompt).toContain('"formalRule"')
    expect(prompt).toContain('"simpleRule"')
    expect(prompt).toContain('"structurePattern"')
    expect(prompt).toContain('"commonErrors"')
    expect(prompt).toContain('"blackboardNotes"')
  })

  it('should include grammar-specific quality requirements', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: GRAMMAR_LANGUAGE_META })
    expect(prompt).toContain('LANGUAGE SUBJECT QUALITY REQUIREMENTS')
    expect(prompt).toContain('grammarNotes.examples: minimum 3')
    expect(prompt).toContain('grammarNotes.commonErrors: minimum 2')
    expect(prompt).toContain('grammarNotes.chapterAnchor')
  })

  it('should include board-specific mention in quality requirements', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: GRAMMAR_LANGUAGE_META })
    expect(prompt).toContain('CBSE')
  })
})

describe('topicNotesPrompt -- language subject (prose with grammar anchor)', () => {
  it('should contain grammar anchor instruction for prose topics', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: PROSE_LANGUAGE_META })
    expect(prompt).toContain('naturally')
    expect(prompt).toContain('chapterAnchor')
  })

  it('should reference the chapter name in the grammar section', () => {
    const prompt = topicNotesPrompt({ ...BASE_PARAMS, languageMeta: PROSE_LANGUAGE_META })
    expect(prompt).toContain('First Flight')
  })
})

describe('topicNotesPrompt -- Hindi language subject', () => {
  const hindiParams = {
    topicName: 'Sandhi',
    grade: 9,
    board: 'CBSE',
    subject: 'Hindi',
    chapter: 'Vyakaran',
    difficultyLevel: 'standard' as const,
    languageMeta: {
      language: 'Hindi',
      topicCategory: 'grammar' as const,
      grammarDomain: 'sandhi',
      grammarLabel: 'Sandhi (Sound Junction)',
      grammarDescription: 'Swar sandhi, vyanjan sandhi, visarg sandhi.',
      examPatterns: ['sandhi kijiye', 'sandhi-viched kijiye'],
      nuances: ['Swar sandhi is most common; students confuse gun and vriddhi.'],
    },
  }

  it('should include Hindi language label', () => {
    const prompt = topicNotesPrompt(hindiParams)
    expect(prompt).toContain('Language: Hindi')
  })

  it('should include Hindi exam patterns', () => {
    const prompt = topicNotesPrompt(hindiParams)
    expect(prompt).toContain('sandhi kijiye')
  })

  it('should include Hindi-specific nuances', () => {
    const prompt = topicNotesPrompt(hindiParams)
    expect(prompt).toContain('Swar sandhi is most common')
  })
})

describe('topicNotesPrompt -- non-language subject (no grammar injection)', () => {
  const mathParams = {
    topicName: 'Quadratic Equations',
    grade: 10,
    board: 'CBSE',
    subject: 'Mathematics',
    chapter: 'Polynomials',
    difficultyLevel: 'standard' as const,
  }

  it('should NOT include grammar section for STEM subjects', () => {
    const prompt = topicNotesPrompt(mathParams)
    expect(prompt).not.toContain('LANGUAGE SUBJECT')
    expect(prompt).not.toContain('grammarNotes')
    expect(prompt).not.toContain('LANGUAGE SUBJECT QUALITY REQUIREMENTS')
  })

  it('should still include standard quality requirements', () => {
    const prompt = topicNotesPrompt(mathParams)
    expect(prompt).toContain('QUALITY REQUIREMENTS')
    expect(prompt).toContain('sections array: minimum')
  })
})
