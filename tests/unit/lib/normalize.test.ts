import { normalizeLanguage, normalizeDifficulty, normalizeJobType, LanguageCode, DifficultyLevel, JobType } from '@/lib/normalize'

describe('normalize utilities', () => {
  test('normalizeLanguage returns en by default and recognizes hi', () => {
    expect(normalizeLanguage(undefined)).toBe(LanguageCode.en)
    expect(normalizeLanguage('EN')).toBe(LanguageCode.en)
    expect(normalizeLanguage('hindi')).toBe(LanguageCode.hi)
    expect(normalizeLanguage('Hi')).toBe(LanguageCode.hi)
  })

  test('normalizeDifficulty returns medium default and maps variants', () => {
    expect(normalizeDifficulty(undefined)).toBe(DifficultyLevel.medium)
    expect(normalizeDifficulty('easy')).toBe(DifficultyLevel.easy)
    expect(normalizeDifficulty('HARD')).toBe(DifficultyLevel.hard)
    expect(normalizeDifficulty('unknown')).toBe(DifficultyLevel.medium)
  })

  test('normalizeJobType maps known keys and throws for unknown', () => {
    expect(normalizeJobType('notes')).toBe(JobType.notes)
    expect(normalizeJobType('  Question  ')).toBe(JobType.questions)
    expect(normalizeJobType('Syllabus')).toBe(JobType.syllabus)
    expect(normalizeJobType('assemble-job')).toBe(JobType.assemble)
    expect(normalizeJobType('test')).toBe(JobType.tests)

    // direct value should pass through
    expect(normalizeJobType('questions')).toBe(JobType.questions)

    expect(() => normalizeJobType(undefined as unknown as string)).toThrow('jobType is required')
    expect(() => normalizeJobType('not-a-known-one')).toThrow(/Unknown jobType/)
  })
})
