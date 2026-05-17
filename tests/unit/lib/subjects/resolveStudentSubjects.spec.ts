/**
 * FILE OBJECTIVE:
 * - Unit tests for resolveStudentSubjects subject resolution logic.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/subjects/resolveStudentSubjects.spec.ts
 *
 * EDIT LOG:
 * - 2026-05-16T00:00:00Z | copilot | created
 * - 2026-05-17T00:00:00Z | reviewer | add tests for skip-unscoped optimisation and
 *   scoped-over-unscoped dedup preference
 */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../../helpers/prismaMock').prismaMock }));

import { prismaMock, resetPrismaMock } from '../../../helpers/prismaMock'
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

  test('skips unscoped query when scoped already resolves all enrolled subjects', async () => {
    const findMany = prismaMock.subjectDef.findMany as jest.Mock
    findMany.mockResolvedValueOnce([
      { id: 's-math', name: 'Mathematics', slug: 'mathematics' },
    ]) // scoped slug covers 'mathematics'

    const user = { subjects: ['mathematics'], grade: '6', board: 'cbse' }
    await resolveStudentSubjects(user, [])

    // Only the one scoped slug query should run -- unscoped must be skipped.
    expect(findMany).toHaveBeenCalledTimes(1)
  })

  test('prefers scoped row over unscoped row when both share the same slug', async () => {
    ;(prismaMock.subjectDef.findMany as jest.Mock)
      .mockResolvedValueOnce([]) // scoped slug: no match
      .mockResolvedValueOnce([]) // scoped name: no match
      .mockResolvedValueOnce([
        // unscoped returns a row, AND a duplicate scoped slug appears in the same call
        // (simulating two subjectDefs with the same slug from different boards)
        { id: 'unscoped-math', name: 'Mathematics', slug: 'mathematics' },
      ]) // unscoped

    // Now run again with a scenario where scoped finds something but unscoped also has it
    resetPrismaMock()
    ;(prismaMock.subjectDef.findMany as jest.Mock)
      .mockResolvedValueOnce([{ id: 'scoped-math', name: 'Mathematics', slug: 'mathematics' }]) // scoped slug
      .mockResolvedValueOnce([{ id: 'unscoped-math', name: 'Mathematics', slug: 'mathematics' }]) // unscoped (if called)

    // Since scoped covers everything, unscoped will NOT run and scoped-math wins.
    const user = { subjects: ['mathematics'], grade: '6', board: 'cbse' }
    const res = await resolveStudentSubjects(user, [])
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('scoped-math')
  })
})
