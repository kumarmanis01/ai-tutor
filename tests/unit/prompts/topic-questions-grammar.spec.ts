/**
 * Unit tests for grammar question prompt builder.
 *
 * Verifies: language question routing, grammar question type distribution,
 * JSON schema shape in the prompt, and that STEM subjects use the MCQ path.
 */

import { topicQuestionsPrompt } from '@/prompts/topic-questions'

const GRAMMAR_LANGUAGE_META = {
  language: 'English',
  topicCategory: 'grammar',
  grammarDomain: 'active_passive_voice',
  grammarLabel: 'Active and Passive Voice',
  examPatterns: ['change to passive voice', 'rewrite as directed'],
  board: 'CBSE',
}

const PROSE_LANGUAGE_META = {
  language: 'English',
  topicCategory: 'prose',
  grammarDomain: 'tenses_perfect',
  grammarLabel: 'Perfect Tenses',
  board: 'CBSE',
}

const HINDI_GRAMMAR_META = {
  language: 'Hindi',
  topicCategory: 'grammar',
  grammarDomain: 'sandhi',
  grammarLabel: 'Sandhi',
  examPatterns: ['sandhi kijiye', 'sandhi-viched kijiye'],
  board: 'CBSE',
}

describe('topicQuestionsPrompt -- language subject (grammar primary)', () => {
  it('should include grammarQuestions in the output schema', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Active and Passive Voice',
      grade: 9,
      count: 7,
      board: 'CBSE',
      subject: 'English',
      languageMeta: GRAMMAR_LANGUAGE_META,
    })
    expect(prompt).toContain('grammarQuestions')
  })

  it('should list all required grammar question types', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Active and Passive Voice',
      grade: 9,
      count: 7,
      board: 'CBSE',
      subject: 'English',
      languageMeta: GRAMMAR_LANGUAGE_META,
    })
    expect(prompt).toContain('"identify"')
    expect(prompt).toContain('"transform"')
    expect(prompt).toContain('"error_correction"')
    expect(prompt).toContain('"rewrite_as_directed"')
    expect(prompt).toContain('"chapter_context"')
  })

  it('should include mandatory distribution requirements', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Active and Passive Voice',
      grade: 9,
      count: 7,
      board: 'CBSE',
      subject: 'English',
      languageMeta: GRAMMAR_LANGUAGE_META,
    })
    expect(prompt).toContain('At least 2 of type "identify" or "transform"')
    expect(prompt).toContain('At least 1 of type "error_correction"')
    expect(prompt).toContain('At least 1 of type "rewrite_as_directed"')
    expect(prompt).toContain('At least 1 of type "chapter_context"')
  })

  it('should include chapterLinked and markingHint in schema', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Active and Passive Voice',
      grade: 9,
      count: 7,
      board: 'CBSE',
      subject: 'English',
      languageMeta: GRAMMAR_LANGUAGE_META,
    })
    expect(prompt).toContain('"chapterLinked"')
    expect(prompt).toContain('"markingHint"')
  })

  it('should include grammarDomain field in schema', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Active and Passive Voice',
      grade: 9,
      count: 7,
      languageMeta: GRAMMAR_LANGUAGE_META,
    })
    expect(prompt).toContain('"grammarDomain"')
  })

  it('should mention the grammar domain label', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Active and Passive Voice',
      grade: 9,
      count: 7,
      languageMeta: GRAMMAR_LANGUAGE_META,
    })
    expect(prompt).toContain('Active and Passive Voice')
  })

  it('should NOT include comprehensionQuestions when topicCategory is grammar', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Active and Passive Voice',
      grade: 9,
      count: 7,
      languageMeta: GRAMMAR_LANGUAGE_META,
    })
    // For pure grammar topics, content Q count is 0, so comprehensionQuestions block is omitted
    expect(prompt).not.toContain('"comprehensionQuestions"')
  })
})

describe('topicQuestionsPrompt -- language subject (prose)', () => {
  it('should include comprehensionQuestions for prose topics', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'A Letter to God',
      grade: 10,
      count: 8,
      board: 'CBSE',
      subject: 'English',
      languageMeta: PROSE_LANGUAGE_META,
    })
    // Prose topic should have both comprehension and grammar sections
    expect(prompt).toContain('"comprehensionQuestions"')
    expect(prompt).toContain('"grammarQuestions"')
  })

  it('should include exam patterns in the prompt', () => {
    const metaWithPatterns = { ...PROSE_LANGUAGE_META, examPatterns: ['fill in with correct tense'] }
    const prompt = topicQuestionsPrompt({
      topicName: 'A Letter to God',
      grade: 10,
      count: 8,
      languageMeta: metaWithPatterns,
    })
    expect(prompt).toContain('fill in with correct tense')
  })
})

describe('topicQuestionsPrompt -- Hindi grammar subject', () => {
  it('should mention the Hindi language', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Sandhi',
      grade: 9,
      count: 6,
      languageMeta: HINDI_GRAMMAR_META,
    })
    expect(prompt).toContain('Hindi')
  })

  it('should include Hindi exam patterns', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Sandhi',
      grade: 9,
      count: 6,
      languageMeta: HINDI_GRAMMAR_META,
    })
    expect(prompt).toContain('sandhi kijiye')
  })
})

describe('topicQuestionsPrompt -- STEM subject (no language meta)', () => {
  it('should use MCQ format for STEM subjects', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Quadratic Equations',
      grade: 10,
      count: 5,
      board: 'CBSE',
      subject: 'Mathematics',
    })
    expect(prompt).toContain('"questions"')
    expect(prompt).toContain('"options"')
    expect(prompt).toContain('"correctAnswer"')
  })

  it('should NOT include grammarQuestions for STEM subjects', () => {
    const prompt = topicQuestionsPrompt({
      topicName: 'Quadratic Equations',
      grade: 10,
      count: 5,
      board: 'CBSE',
      subject: 'Mathematics',
    })
    expect(prompt).not.toContain('grammarQuestions')
    expect(prompt).not.toContain('grammarDomain')
    expect(prompt).not.toContain('chapterLinked')
  })
})
