import {
  detectLanguageSubject,
  splitQuestionCounts,
} from '@/lib/quiz/languageSubjectDetector';

describe('detectLanguageSubject', () => {
  it('should detect Hindi as a language subject', () => {
    const result = detectLanguageSubject('Hindi');
    expect(result.isLanguage).toBe(true);
    expect(result.language).toBe('Hindi');
    expect(result.grammarCategories.length).toBeGreaterThan(0);
    expect(result.grammarRatio).toBeGreaterThan(0);
  });

  it('should detect English as a language subject', () => {
    const result = detectLanguageSubject('English Language');
    expect(result.isLanguage).toBe(true);
    expect(result.language).toBe('English');
    expect(result.grammarCategories).toContain('tenses');
    expect(result.grammarCategories).toContain('active_passive');
  });

  it('should detect Urdu as a language subject', () => {
    const result = detectLanguageSubject('Urdu');
    expect(result.isLanguage).toBe(true);
    expect(result.language).toBe('Urdu');
  });

  it('should detect Sanskrit as a language subject', () => {
    const result = detectLanguageSubject('Sanskrit');
    expect(result.isLanguage).toBe(true);
    expect(result.language).toBe('Sanskrit');
    expect(result.grammarCategories).toContain('sandhi_samas');
    expect(result.grammarCategories).toContain('karak_vibhakti');
  });

  it('should detect case-insensitively', () => {
    const result = detectLanguageSubject('HINDI');
    expect(result.isLanguage).toBe(true);
    expect(result.language).toBe('Hindi');
  });

  it('should return false for Mathematics', () => {
    const result = detectLanguageSubject('Mathematics');
    expect(result.isLanguage).toBe(false);
    expect(result.language).toBeNull();
    expect(result.grammarCategories).toHaveLength(0);
    expect(result.grammarRatio).toBe(0);
  });

  it('should return false for Science', () => {
    const result = detectLanguageSubject('Science');
    expect(result.isLanguage).toBe(false);
  });

  it('should return false for Physics', () => {
    const result = detectLanguageSubject('Physics');
    expect(result.isLanguage).toBe(false);
  });

  it('should return false for empty string', () => {
    const result = detectLanguageSubject('');
    expect(result.isLanguage).toBe(false);
  });

  it('should include Hindi-specific grammar categories', () => {
    const result = detectLanguageSubject('Hindi');
    expect(result.grammarCategories).toContain('sandhi_samas');
    expect(result.grammarCategories).toContain('ras_chhand_alankar');
    expect(result.grammarCategories).toContain('karak_vibhakti');
    expect(result.grammarCategories).toContain('upsarg_pratyay');
  });

  it('should include English-specific grammar categories', () => {
    const result = detectLanguageSubject('English');
    expect(result.grammarCategories).toContain('punctuation_capitalisation');
    expect(result.grammarCategories).toContain('comprehension');
    expect(result.grammarCategories).toContain('direct_indirect_speech');
  });
});

describe('splitQuestionCounts', () => {
  it('should split 10 questions with 35% grammar ratio', () => {
    const result = splitQuestionCounts(10, 0.35);
    expect(result.grammarCount).toBe(4); // round(10 * 0.35) = 4 (rounded from 3.5)
    expect(result.contentCount).toBe(6);
    expect(result.grammarCount + result.contentCount).toBe(10);
  });

  it('should return 0 grammar for ratio 0', () => {
    const result = splitQuestionCounts(10, 0);
    expect(result.grammarCount).toBe(0);
    expect(result.contentCount).toBe(10);
  });

  it('should ensure at least 1 grammar question when ratio > 0', () => {
    const result = splitQuestionCounts(2, 0.1);
    expect(result.grammarCount).toBeGreaterThanOrEqual(1);
    expect(result.contentCount).toBeGreaterThanOrEqual(1);
  });

  it('should handle total of 5', () => {
    const result = splitQuestionCounts(5, 0.35);
    expect(result.grammarCount + result.contentCount).toBe(5);
    expect(result.grammarCount).toBeGreaterThanOrEqual(1);
  });
});
