import { assertContentLanguage } from '@/lib/content/language-validator';

describe('assertContentLanguage', () => {
  describe('when contentLanguageCode is "en"', () => {
    it('should never throw regardless of content', () => {
      expect(() => assertContentLanguage({ question: 'What is photosynthesis?' }, 'en')).not.toThrow();
      expect(() => assertContentLanguage({ title: 'Chapter 1: Cell Biology' }, 'en')).not.toThrow();
    });
  });

  describe('when contentLanguageCode is non-English', () => {
    it('should not throw for pure native-script content', () => {
      expect(() =>
        assertContentLanguage(
          { question: 'संज्ञा किसे कहते हैं?', answer: 'वह शब्द जो नाम बताए' },
          'hi',
        ),
      ).not.toThrow();
    });

    it('should throw when English contamination exceeds threshold', () => {
      expect(() =>
        assertContentLanguage(
          { question: 'What is the meaning of noun in Hindi grammar?' },
          'hi',
        ),
      ).toThrow('Language violation');
    });

    it('should include field name and ratio in error message', () => {
      let err: Error | null = null;
      try {
        assertContentLanguage({ explanation: 'This is a full English explanation.' }, 'hi');
      } catch (e) {
        err = e as Error;
      }
      expect(err).not.toBeNull();
      expect(err!.message).toContain('"explanation"');
      expect(err!.message).toContain('contentLanguage is "hi"');
    });

    it('should skip undefined or null fields', () => {
      expect(() =>
        assertContentLanguage({ question: undefined as unknown as string, title: null as unknown as string }, 'hi'),
      ).not.toThrow();
    });

    it('should join array values when checking options field', () => {
      expect(() =>
        assertContentLanguage(
          { options: ['Option A in English', 'Option B in English', 'Option C here'] },
          'hi',
        ),
      ).toThrow('Language violation');
    });

    it('should not throw for array options in native script', () => {
      expect(() =>
        assertContentLanguage(
          { options: ['पहला विकल्प', 'दूसरा विकल्प', 'तीसरा विकल्प'] },
          'hi',
        ),
      ).not.toThrow();
    });

    it('should respect custom threshold', () => {
      // Pure Devanagari -- passes even at very strict threshold
      expect(() => assertContentLanguage({ title: 'हिंदी व्याकरण' }, 'hi', 0.01)).not.toThrow();
      // Single Latin char in an 8-char string is ~12.5% -- passes default (15%) but fails strict (1%)
      expect(() => assertContentLanguage({ title: 'अध्याय A' }, 'hi')).not.toThrow();
      expect(() => assertContentLanguage({ title: 'अध्याय A' }, 'hi', 0.01)).toThrow('Language violation');
    });

    it('should check all CONTENT_FIELDS present', () => {
      const allFieldsEnglish = {
        question: 'What is the answer?',
        answer: 'The answer is yes.',
        explanation: 'This explains why.',
        title: 'Chapter Title',
        description: 'Chapter description',
        summary: 'Summary text here.',
      };
      expect(() => assertContentLanguage(allFieldsEnglish, 'ta')).toThrow('Language violation');
    });
  });
});
