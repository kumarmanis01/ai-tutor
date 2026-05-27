/**
 * Unit tests for resolveInteractionLanguage and isLanguageSubject.
 *
 * LINKED SERVICE:
 * - services/interaction-language.service.ts
 */
import { SubjectType } from '@prisma/client';
import {
  resolveInteractionLanguage,
  isLanguageSubject,
} from '@/services/interaction-language.service';

describe('resolveInteractionLanguage', () => {
  it('returns targetLanguage for LANGUAGE subjects regardless of student locale', () => {
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.LANGUAGE, targetLanguage: 'hi' }, 'en'),
    ).toBe('hi');
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.LANGUAGE, targetLanguage: 'fr' }, 'te'),
    ).toBe('fr');
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.LANGUAGE, targetLanguage: 'sa' }, 'hi'),
    ).toBe('sa');
  });

  it('returns studentUiLocale for non-LANGUAGE subjects', () => {
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.STEM, targetLanguage: null }, 'ta'),
    ).toBe('ta');
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.SOCIAL, targetLanguage: null }, 'en'),
    ).toBe('en');
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.VOCATIONAL, targetLanguage: null }, 'hi'),
    ).toBe('hi');
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.OTHER, targetLanguage: null }, 'en'),
    ).toBe('en');
  });

  it('falls back to studentUiLocale if LANGUAGE subject has no targetLanguage', () => {
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.LANGUAGE, targetLanguage: null }, 'en'),
    ).toBe('en');
    expect(
      resolveInteractionLanguage({ subjectType: SubjectType.LANGUAGE, targetLanguage: null }, 'hi'),
    ).toBe('hi');
  });

  it('LANGUAGE subjects with targetLanguage always override student locale', () => {
    const subject = { subjectType: SubjectType.LANGUAGE, targetLanguage: 'ta' };
    expect(resolveInteractionLanguage(subject, 'hi')).toBe('ta');
    expect(resolveInteractionLanguage(subject, 'en')).toBe('ta');
    expect(resolveInteractionLanguage(subject, 'fr')).toBe('ta');
  });
});

describe('isLanguageSubject', () => {
  it('returns true for LANGUAGE subjects', () => {
    expect(isLanguageSubject({ subjectType: SubjectType.LANGUAGE })).toBe(true);
  });

  it('returns false for all non-LANGUAGE subjects', () => {
    expect(isLanguageSubject({ subjectType: SubjectType.STEM })).toBe(false);
    expect(isLanguageSubject({ subjectType: SubjectType.SOCIAL })).toBe(false);
    expect(isLanguageSubject({ subjectType: SubjectType.VOCATIONAL })).toBe(false);
    expect(isLanguageSubject({ subjectType: SubjectType.OTHER })).toBe(false);
  });
});
