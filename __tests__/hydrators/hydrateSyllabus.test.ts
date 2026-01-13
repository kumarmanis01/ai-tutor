import { enqueueSyllabusHydration } from '../../hydrators/hydrateSyllabus'

jest.mock('@/lib/resolveAcademicIds', () => ({
  resolveSubjectId: jest.fn().mockResolvedValue({ success: true, subjectId: 'sub-1' })
}))

jest.mock('@/lib/prisma', () => ({
  prisma: {
    systemSetting: { findUnique: jest.fn().mockResolvedValue(null) },
    chapterDef: { findFirst: jest.fn().mockResolvedValue(null) },
    hydrationJob: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 'job-1' }) }
  }
}))

describe('enqueueSyllabusHydration', () => {
  afterEach(() => {
    delete process.env.REDIS_URL
  })

  test('returns redis_not_configured when REDIS_URL missing', async () => {
    delete process.env.REDIS_URL
    const res = await enqueueSyllabusHydration({ board: 'CBSE', grade: 4, subject: 'Mathematics', subjectId: '' })
    expect(res.created).toBe(false)
    expect(res.reason).toBe('redis_not_configured')
  })
})
