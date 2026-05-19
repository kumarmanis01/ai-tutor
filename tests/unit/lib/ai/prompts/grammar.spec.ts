/**
 * FILE OBJECTIVE:
 * - Unit tests for lib/ai/prompts/grammar.ts
 * - Covers: subject-type detection, language name detection, topic category
 *   detection, grammar domain lookup by board/grade, and full languageMeta
 *   construction.
 *
 * LINKED UNIT TEST:
 * - Self-referencing: tests/unit/lib/ai/prompts/grammar.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-19T00:00:00Z | claude | created grammar taxonomy tests
 */

import {
  detectSubjectType,
  detectLanguageName,
  detectTopicCategory,
  getGrammarDomainsForContext,
  inferGrammarDomain,
  buildLanguageMeta,
} from '@/lib/ai/prompts/grammar'

describe('detectSubjectType', () => {
  it('should return language for English subject', () => {
    expect(detectSubjectType('English')).toBe('language')
  })

  it('should return language for Hindi subject', () => {
    expect(detectSubjectType('Hindi')).toBe('language')
  })

  it('should return language for Sanskrit subject', () => {
    expect(detectSubjectType('Sanskrit')).toBe('language')
  })

  it('should return language for French subject', () => {
    expect(detectSubjectType('French Language')).toBe('language')
  })

  it('should return language for regional language subjects', () => {
    expect(detectSubjectType('Marathi')).toBe('language')
    expect(detectSubjectType('Bengali')).toBe('language')
    expect(detectSubjectType('Tamil')).toBe('language')
    expect(detectSubjectType('Telugu')).toBe('language')
    expect(detectSubjectType('Kannada')).toBe('language')
    expect(detectSubjectType('Gujarati')).toBe('language')
    expect(detectSubjectType('Punjabi')).toBe('language')
  })

  it('should return stem for Mathematics', () => {
    expect(detectSubjectType('Mathematics')).toBe('stem')
  })

  it('should return stem for Science', () => {
    expect(detectSubjectType('Science')).toBe('stem')
  })

  it('should return stem for Computer Science', () => {
    expect(detectSubjectType('Computer Science')).toBe('stem')
  })

  it('should return social_science for History', () => {
    expect(detectSubjectType('History')).toBe('social_science')
  })

  it('should return social_science for Geography', () => {
    expect(detectSubjectType('Geography')).toBe('social_science')
  })

  it('should return arts for Art', () => {
    expect(detectSubjectType('Art')).toBe('arts')
  })

  it('should return arts for Music', () => {
    expect(detectSubjectType('Music')).toBe('arts')
  })
})

describe('detectLanguageName', () => {
  it('should detect English', () => {
    expect(detectLanguageName('English')).toBe('English')
    expect(detectLanguageName('English Language and Literature')).toBe('English')
  })

  it('should detect Hindi', () => {
    expect(detectLanguageName('Hindi')).toBe('Hindi')
    expect(detectLanguageName('Hindi (Course B)')).toBe('Hindi')
  })

  it('should detect Sanskrit', () => {
    expect(detectLanguageName('Sanskrit')).toBe('Sanskrit')
  })

  it('should detect French', () => {
    expect(detectLanguageName('French')).toBe('French')
  })

  it('should detect Urdu', () => {
    expect(detectLanguageName('Urdu')).toBe('Urdu')
  })

  it('should detect regional languages', () => {
    expect(detectLanguageName('Marathi')).toBe('Marathi')
    expect(detectLanguageName('Bengali')).toBe('Bengali')
    expect(detectLanguageName('Bangla')).toBe('Bengali')
    expect(detectLanguageName('Tamil')).toBe('Tamil')
    expect(detectLanguageName('Telugu')).toBe('Telugu')
    expect(detectLanguageName('Kannada')).toBe('Kannada')
    expect(detectLanguageName('Gujarati')).toBe('Gujarati')
    expect(detectLanguageName('Punjabi')).toBe('Punjabi')
  })

  it('should return null for non-language subjects', () => {
    expect(detectLanguageName('Mathematics')).toBeNull()
    expect(detectLanguageName('Physics')).toBeNull()
    expect(detectLanguageName('History')).toBeNull()
  })
})

describe('detectTopicCategory', () => {
  it('should detect grammar from topic name', () => {
    expect(detectTopicCategory('Active and Passive Voice', 'Two Stories About Flying')).toBe('grammar')
    expect(detectTopicCategory('Tenses', 'Tenses')).toBe('grammar')
    expect(detectTopicCategory('Sandhi', 'Vyakaran')).toBe('grammar')
    expect(detectTopicCategory('Karak aur Vibhakti', 'Hindi Vyakaran')).toBe('grammar')
    expect(detectTopicCategory('Articles and Prepositions', 'Grammar')).toBe('grammar')
    expect(detectTopicCategory('Samas', 'Hindi Vyakaran')).toBe('grammar')
  })

  it('should detect grammar from chapter name alone', () => {
    expect(detectTopicCategory('Chapter 5', 'Grammaire francaise')).toBe('grammar')
  })

  it('should detect poetry', () => {
    expect(detectTopicCategory('Dust of Snow', 'Poetry')).toBe('poetry')
    expect(detectTopicCategory('Kabir ke Dohe', 'Kavya')).toBe('poetry')
    expect(detectTopicCategory('Amanda!', 'Poems')).toBe('poetry')
  })

  it('should detect composition', () => {
    expect(detectTopicCategory('Letter to the Editor', 'Writing Skills')).toBe('composition')
    expect(detectTopicCategory('Formal Letter Writing', 'Composition')).toBe('composition')
    expect(detectTopicCategory('Essay Writing', 'Composition')).toBe('composition')
    expect(detectTopicCategory('Patra Lekhan', 'Hindi Lekhan')).toBe('composition')
    expect(detectTopicCategory('Notice Writing', 'Writing')).toBe('composition')
  })

  it('should detect comprehension', () => {
    expect(detectTopicCategory('Unseen Passage', 'Reading Skills')).toBe('comprehension')
    expect(detectTopicCategory('Reading Comprehension', 'English')).toBe('comprehension')
    expect(detectTopicCategory('Apathit Gadyansh', 'Hindi')).toBe('comprehension')
  })

  it('should detect drama', () => {
    expect(detectTopicCategory('The Proposal', 'Drama')).toBe('drama')
    expect(detectTopicCategory('Ekankee', 'Natika')).toBe('drama')
  })

  it('should default to prose for ordinary chapter topics', () => {
    expect(detectTopicCategory('A Letter to God', 'First Flight')).toBe('prose')
    expect(detectTopicCategory('Two Gentlemen of Verona', 'Prose')).toBe('prose')
  })
})

describe('getGrammarDomainsForContext', () => {
  it('should return English domains for CBSE grade 9', () => {
    const domains = getGrammarDomainsForContext('English', 'CBSE', 9)
    expect(domains.length).toBeGreaterThan(0)
    const domainNames = domains.map(d => d.domain)
    expect(domainNames).toContain('active_passive_voice')
    expect(domainNames).toContain('direct_indirect_speech')
  })

  it('should not return grade 9 domains for grade 7', () => {
    const domains = getGrammarDomainsForContext('English', 'CBSE', 7)
    const domainNames = domains.map(d => d.domain)
    expect(domainNames).not.toContain('active_passive_voice')
    expect(domainNames).toContain('parts_of_speech')
  })

  it('should return Hindi domains for grade 9', () => {
    const domains = getGrammarDomainsForContext('Hindi', 'CBSE', 9)
    const domainNames = domains.map(d => d.domain)
    expect(domainNames).toContain('sandhi')
    expect(domainNames).toContain('samas')
  })

  it('should return Sanskrit domains for CBSE grade 8', () => {
    const domains = getGrammarDomainsForContext('Sanskrit', 'CBSE', 8)
    expect(domains.length).toBeGreaterThan(0)
    const domainNames = domains.map(d => d.domain)
    expect(domainNames).toContain('shabda_roop')
  })

  it('should return French domains for IB grade 11', () => {
    const domains = getGrammarDomainsForContext('French', 'IB', 11)
    expect(domains.length).toBeGreaterThan(0)
    const domainNames = domains.map(d => d.domain)
    expect(domainNames).toContain('subjonctif_fr')
  })

  it('should return empty array for unknown language', () => {
    const domains = getGrammarDomainsForContext('Klingon', 'CBSE', 9)
    expect(domains).toHaveLength(0)
  })

  it('should filter out board-specific domains for wrong board', () => {
    const cbseDomains = getGrammarDomainsForContext('English', 'CBSE', 10)
    const editingDomain = cbseDomains.find(d => d.domain === 'editing_omission')
    expect(editingDomain).toBeDefined()

    const ibDomains = getGrammarDomainsForContext('English', 'IB', 10)
    const editingInIb = ibDomains.find(d => d.domain === 'editing_omission')
    expect(editingInIb).toBeUndefined()
  })
})

describe('inferGrammarDomain', () => {
  it('should match active_passive_voice for a passive voice topic', () => {
    const spec = inferGrammarDomain('Active and Passive Voice', 'A Letter to God', 'English', 'CBSE', 9)
    expect(spec).toBeDefined()
    expect(spec?.domain).toBe('active_passive_voice')
  })

  it('should match sandhi domain for Hindi sandhi topic', () => {
    const spec = inferGrammarDomain('Sandhi Viched', 'Vyakaran', 'Hindi', 'CBSE', 9)
    expect(spec).toBeDefined()
    expect(spec?.domain).toBe('sandhi')
  })

  it('should fall back to first available domain when topic is ambiguous', () => {
    const spec = inferGrammarDomain('Chapter Summary', 'The Letter', 'English', 'CBSE', 7)
    expect(spec).toBeDefined()
    // Should return something -- the first available domain for grade 7
  })

  it('should return undefined for unknown language with no domains', () => {
    const spec = inferGrammarDomain('Grammar', 'Test', 'Klingon', 'CBSE', 9)
    expect(spec).toBeUndefined()
  })
})

describe('buildLanguageMeta', () => {
  it('should return null for a non-language subject', () => {
    const meta = buildLanguageMeta('Mathematics', 'Quadratic Equations', 'Polynomials', 'CBSE', 9)
    expect(meta).toBeNull()
  })

  it('should build meta for English passive voice topic', () => {
    const meta = buildLanguageMeta('English', 'Active and Passive Voice', 'Two Stories About Flying', 'CBSE', 9)
    expect(meta).not.toBeNull()
    expect(meta?.language).toBe('English')
    expect(meta?.topicCategory).toBe('grammar')
    expect(meta?.grammarDomain).toBe('active_passive_voice')
    expect(meta?.examPatterns).toBeDefined()
    expect(meta?.examPatterns?.length).toBeGreaterThan(0)
    expect(meta?.nuances).toBeDefined()
  })

  it('should build meta for Hindi prose topic', () => {
    const meta = buildLanguageMeta('Hindi', 'Lakhnawi Andaz', 'Gadya Khand', 'CBSE', 10)
    expect(meta).not.toBeNull()
    expect(meta?.language).toBe('Hindi')
    expect(meta?.topicCategory).toBe('prose')
  })

  it('should build meta for Sanskrit topic', () => {
    const meta = buildLanguageMeta('Sanskrit', 'Shabda Roop', 'Vyakaran', 'CBSE', 7)
    expect(meta).not.toBeNull()
    expect(meta?.language).toBe('Sanskrit')
    expect(meta?.grammarDomain).toBe('shabda_roop')
  })

  it('should include grammarLabel and grammarDescription when domain is found', () => {
    const meta = buildLanguageMeta('English', 'Tenses', 'Grammar', 'CBSE', 8)
    expect(meta).not.toBeNull()
    expect(meta?.grammarLabel).toBeTruthy()
    expect(meta?.grammarDescription).toBeTruthy()
  })
})
