/**
 * Unit tests for resolveInteractionLanguage and isLanguageSubject.
 *
 * LINKED SERVICE:
 * - services/interaction-language.service.ts
 */
import {
  resolveInteractionLanguage,
  isLanguageSubject,
} from '@/services/interaction-language.service';

// Use string literals matching the SubjectType enum values -- avoids Prisma import.
const ST = {
  LANGUAGE: 'LANGUAGE',
  STEM: 'STEM',
  SOCIAL: 'SOCIAL',
  VOCATIONAL: 'VOCATIONAL',
  OTHER: 'OTHER',
} as const;

describe('resolveInteractionLanguage', () => {
  it('returns targetLanguage for LANGUAGE subjects regardless of student locale', () => {
    expect(
      resolveInteractionLanguage({ subjectType: ST.LANGUAGE, targetLanguage: 'hi' }, 'en'),
    ).toBe('hi');
    expect(
      resolveInteractionLanguage({ subjectType: ST.LANGUAGE, targetLanguage: 'fr' }, 'te'),
    ).toBe('fr');
    expect(
      resolveInteractionLanguage({ subjectType: ST.LANGUAGE, targetLanguage: 'sa' }, 'hi'),
    ).toBe('sa');
  });

  it('returns studentUiLocale for non-LANGUAGE subjects', () => {
    expect(
      resolveInteractionLanguage({ subjectType: ST.STEM, targetLanguage: null }, 'ta'),
    ).toBe('ta');
    expect(
      resolveInteractionLanguage({ subjectType: ST.SOCIAL, targetLanguage: null }, 'en'),
    ).toBe('en');
    expect(
      resolveInteractionLanguage({ subjectType: ST.VOCATIONAL, targetLanguage: null }, 'hi'),
    ).toBe('hi');
    expect(
      resolveInteractionLanguage({ subjectType: ST.OTHER, targetLanguage: null }, 'en'),
    ).toBe('en');
  });

  it('falls back to studentUiLocale if LANGUAGE subject has no targetLanguage', () => {
    expect(
      resolveInteractionLanguage({ subjectType: ST.LANGUAGE, targetLanguage: null }, 'en'),
    ).toBe('en');
    expect(
      resolveInteractionLanguage({ subjectType: ST.LANGUAGE, targetLanguage: null }, 'hi'),
    ).toBe('hi');
  });

  it('LANGUAGE subjects with targetLanguage always override student locale', () => {
    const subject = { subjectType: ST.LANGUAGE, targetLanguage: 'ta' };
    expect(resolveInteractionLanguage(subject, 'hi')).toBe('ta');
    expect(resolveInteractionLanguage(subject, 'en')).toBe('ta');
    expect(resolveInteractionLanguage(subject, 'fr')).toBe('ta');
  });
});

describe('isLanguageSubject', () => {
  it('returns true for LANGUAGE subjects', () => {
    expect(isLanguageSubject({ subjectType: ST.LANGUAGE })).toBe(true);
  });

  it('returns false for all non-LANGUAGE subjects', () => {
    expect(isLanguageSubject({ subjectType: ST.STEM })).toBe(false);
    expect(isLanguageSubject({ subjectType: ST.SOCIAL })).toBe(false);
    expect(isLanguageSubject({ subjectType: ST.VOCATIONAL })).toBe(false);
    expect(isLanguageSubject({ subjectType: ST.OTHER })).toBe(false);
  });
});
