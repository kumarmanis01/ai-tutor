/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() } }));
jest.mock('@/lib/ai/learningPlan', () => ({ generateLearningPlan: jest.fn().mockResolvedValue('plan-1') }));

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('User profile PATCH (examDate) API', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'student-1', role: 'user', email: 'student@example.test' } }
  })

  it('updates examDate and triggers learning plan regen when plans exist', async () => {
    prismaMock.learningPlan.findMany.mockResolvedValue([{ subjectId: 'sub-1', weeklyGoal: 5 }])
    prismaMock.user.update.mockResolvedValue({ id: 'student-1', learningStyle: null, preferences: {}, examDate: new Date('2026-05-01T00:00:00.000Z') })

    const { PATCH } = await import('@/app/api/user/profile/route')
    const req = new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ examDate: '2026-05-01T00:00:00.000Z' }), headers: { 'Content-Type': 'application/json' } })
    const res = await PATCH(req as any) as any
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalled()

    // allow background regen to run
    await new Promise((r) => setImmediate(r))
    const { generateLearningPlan } = await import('@/lib/ai/learningPlan') as any
    expect(generateLearningPlan).toHaveBeenCalled()
  })
})
