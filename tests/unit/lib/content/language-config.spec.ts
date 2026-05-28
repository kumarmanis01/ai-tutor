import { CONTENT_LANGUAGE_MAP, resolveContentLanguage } from '@/lib/content/language-config';

describe('CONTENT_LANGUAGE_MAP', () => {
  it('should contain all major Indian languages', () => {
    const expected = ['hindi', 'marathi', 'gujarati', 'sanskrit', 'tamil', 'telugu', 'kannada', 'malayalam', 'bengali', 'punjabi', 'urdu', 'english'];
    for (const lang of expected) {
      expect(CONTENT_LANGUAGE_MAP[lang]).toBeDefined();
    }
  });

  it('should have correct BCP-47 codes', () => {
    expect(CONTENT_LANGUAGE_MAP['hindi'].code).toBe('hi');
    expect(CONTENT_LANGUAGE_MAP['tamil'].code).toBe('ta');
    expect(CONTENT_LANGUAGE_MAP['english'].code).toBe('en');
  });

  it('should have correct script assignments', () => {
    expect(CONTENT_LANGUAGE_MAP['hindi'].script).toBe('Devanagari');
    expect(CONTENT_LANGUAGE_MAP['marathi'].script).toBe('Devanagari');
    expect(CONTENT_LANGUAGE_MAP['gujarati'].script).toBe('Gujarati');
    expect(CONTENT_LANGUAGE_MAP['urdu'].script).toBe('Nastaliq');
  });
});

describe('resolveContentLanguage', () => {
  it('should resolve exact subject name match', () => {
    const result = resolveContentLanguage('hindi');
    expect(result.code).toBe('hi');
    expect(result.name).toBe('Hindi');
  });

  it('should resolve case-insensitively', () => {
    expect(resolveContentLanguage('HINDI').code).toBe('hi');
    expect(resolveContentLanguage('Tamil').code).toBe('ta');
  });

  it('should resolve partial match for compound subject names', () => {
    expect(resolveContentLanguage('Hindi Literature').code).toBe('hi');
    expect(resolveContentLanguage('Hindi Grammar').code).toBe('hi');
    expect(resolveContentLanguage('Tamil Language').code).toBe('ta');
    expect(resolveContentLanguage('Sanskrit Classical').code).toBe('sa');
  });

  it('should return English for non-language subjects', () => {
    expect(resolveContentLanguage('Mathematics').code).toBe('en');
    expect(resolveContentLanguage('Science').code).toBe('en');
    expect(resolveContentLanguage('Social Studies').code).toBe('en');
    expect(resolveContentLanguage('Physics').code).toBe('en');
  });

  it('should return English for unknown subjects', () => {
    const result = resolveContentLanguage('Unknown Subject XYZ');
    expect(result.code).toBe('en');
  });

  it('should trim whitespace before matching', () => {
    expect(resolveContentLanguage('  hindi  ').code).toBe('hi');
  });
});
