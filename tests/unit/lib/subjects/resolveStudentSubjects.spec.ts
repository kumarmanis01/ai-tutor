jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));

import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import resolveStudentSubjects from '@/lib/subjects/resolveStudentSubjects'

describe('resolveStudentSubjects', () => {
  beforeEach(() => {
    resetPrismaMock()
  })

  test('scoped slug match', async () => {
    ;(prismaMock.subjectDef.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 's-math', name: 'Mathematics', slug: 'mathematics' },
    ])

    const user = { subjects: ['mathematics'], grade: '6', board: 'cbse' }
    const res = await resolveStudentSubjects(user, [])
    expect(res).toEqual([{ id: 's-math', name: 'Mathematics', slug: 'mathematics' }])
  })

  test('scoped name fallback when slug not found', async () => {
    ;(prismaMock.subjectDef.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // scoped slug
      .mockResolvedValueOnce([{ id: 's-env', name: 'Environmental Studies', slug: 'environmental-studies' }]) // scoped name

    const user = { subjects: ['Environmental Studies'], grade: '6', board: 'cbse' }
    const res = await resolveStudentSubjects(user, [])
    expect(res).toEqual([{ id: 's-env', name: 'Environmental Studies', slug: 'environmental-studies' }])
  })

  test('unscoped fallback when no scoped matches', async () => {
    ;(prismaMock.subjectDef.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // scoped slug
      .mockResolvedValueOnce([]) // scoped name
      .mockResolvedValueOnce([{ id: 's-ss', name: 'Social Science', slug: 'social-science' }]) // unscoped

    const user = { subjects: ['social-science'], grade: '6', board: 'cbse' }
    const res = await resolveStudentSubjects(user, [])
    expect(res).toEqual([{ id: 's-ss', name: 'Social Science', slug: 'social-science' }])
  })

  test('falls back to learningPlans when enrolledSubjects missing', async () => {
    ;(prismaMock.subjectDef.findMany as jest.Mock).mockResolvedValueOnce([{ id: 's-plan', name: 'Planned', slug: 'planned' }])

    const user = { subjects: null, grade: null, board: null }
    const res = await resolveStudentSubjects(user, [{ subjectId: 's-plan' }])
    expect(res).toEqual([{ id: 's-plan', name: 'Planned', slug: 'planned' }])
  })
})
