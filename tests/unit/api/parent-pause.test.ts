/*
 * FILE OBJECTIVE:
 * - Unit tests for Parent pause API (pause/unpause child linking).
 *
 * LINKED UNIT TEST:
 * - tests/unit/api/parent-pause.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-09T00:00:00Z | copilot | assert streakShield.consumeShield called on pause
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() } }));
jest.mock('@/lib/student/streakShield', () => ({ consumeShield: jest.fn().mockResolvedValue(true) }));
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('Parent pause API', () => {
  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'parent-1', role: 'parent', email: 'parent@example.test' } }
  })

  it('POST pause updates ParentStudent and returns ok', async () => {
    prismaMock.parentStudent.findUnique.mockResolvedValue({ id: 'link-1', status: 'active' })
    prismaMock.parentStudent.update.mockResolvedValue({ id: 'link-1', isPaused: true, pausedUntil: new Date('2026-05-01T00:00:00.000Z') })

    const { POST } = await import('@/app/api/parent/pause/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ studentId: 'student-1', action: 'pause', pausedUntil: '2026-05-01T00:00:00.000Z', pauseReason: 'vacation' }), headers: { 'Content-Type': 'application/json' } })
    const response = await POST(req as any) as any
    const data = await response.json()

    expect(data.ok).toBe(true)
    expect(prismaMock.parentStudent.update).toHaveBeenCalled()
    const streakShield = await import('@/lib/student/streakShield')
    expect(streakShield.consumeShield).toHaveBeenCalledWith('student-1')
  })

  it('POST returns 401 when not authenticated', async () => {
    ;(global as any).__TEST_SESSION__ = null
    const { POST } = await import('@/app/api/parent/pause/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ studentId: 'student-1', action: 'pause' }), headers: { 'Content-Type': 'application/json' } })
    const response = await POST(req as any) as any
    expect(response.status).toBe(401)
  })
})
