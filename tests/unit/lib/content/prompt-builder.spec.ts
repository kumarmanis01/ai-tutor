import { buildContentSystemPrompt, CONTENT_SYSTEM_PROMPT } from '@/lib/content/prompt-builder';

describe('CONTENT_SYSTEM_PROMPT', () => {
  it('should contain all five template placeholders', () => {
    expect(CONTENT_SYSTEM_PROMPT).toContain('{board}');
    expect(CONTENT_SYSTEM_PROMPT).toContain('{grade}');
    expect(CONTENT_SYSTEM_PROMPT).toContain('{subjectName}');
    expect(CONTENT_SYSTEM_PROMPT).toContain('{contentLanguage}');
    expect(CONTENT_SYSTEM_PROMPT).toContain('{contentLanguageName}');
  });

  it('should contain the five enforcement rules', () => {
    expect(CONTENT_SYSTEM_PROMPT).toContain('RULE 1');
    expect(CONTENT_SYSTEM_PROMPT).toContain('RULE 2');
    expect(CONTENT_SYSTEM_PROMPT).toContain('RULE 3');
    expect(CONTENT_SYSTEM_PROMPT).toContain('RULE 4');
    expect(CONTENT_SYSTEM_PROMPT).toContain('RULE 5');
  });
});

describe('buildContentSystemPrompt', () => {
  it('should return empty string for English subjects', () => {
    const result = buildContentSystemPrompt({ name: 'Mathematics', board: 'CBSE', grade: '9' });
    expect(result).toBe('');
  });

  it('should return empty string for Science subject', () => {
    expect(buildContentSystemPrompt({ name: 'Science', board: 'ICSE', grade: '7' })).toBe('');
  });

  it('should substitute all placeholders for Hindi subject', () => {
    const result = buildContentSystemPrompt({ name: 'Hindi', board: 'CBSE', grade: '8' });
    expect(result).toContain('Board: CBSE');
    expect(result).toContain('Grade: 8');
    expect(result).toContain('Subject: Hindi');
    expect(result).toContain('Content Language: hi');
    expect(result).toContain('Content Language Name: Hindi');
  });

  it('should not contain raw placeholders after substitution', () => {
    const result = buildContentSystemPrompt({ name: 'Tamil', board: 'State Board', grade: '10' });
    expect(result).not.toContain('{board}');
    expect(result).not.toContain('{grade}');
    expect(result).not.toContain('{subjectName}');
    expect(result).not.toContain('{contentLanguage}');
    expect(result).not.toContain('{contentLanguageName}');
  });

  it('should set correct language code for Tamil', () => {
    const result = buildContentSystemPrompt({ name: 'Tamil', board: 'State Board', grade: '10' });
    expect(result).toContain('Content Language: ta');
    expect(result).toContain('Content Language Name: Tamil');
  });

  it('should handle compound language subject names', () => {
    const result = buildContentSystemPrompt({ name: 'Hindi Literature', board: 'CBSE', grade: '11' });
    expect(result).toContain('Content Language: hi');
    expect(result).not.toBe('');
  });

  it('should be non-empty for all supported language subjects', () => {
    const subjects = ['Hindi', 'Marathi', 'Gujarati', 'Sanskrit', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Bengali', 'Punjabi', 'Urdu'];
    for (const name of subjects) {
      const result = buildContentSystemPrompt({ name, board: 'CBSE', grade: '9' });
      expect(result).not.toBe('');
    }
  });
});
