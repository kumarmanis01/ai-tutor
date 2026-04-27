/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logAPI: jest.fn() } }));

import { describe, it, expect, beforeEach } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'

describe('Parent alerts mute link', () => {
  beforeEach(() => {
    resetPrismaMock()
    // Ensure a predictable signing secret for token generation
    process.env.PARENT_ALERT_SIGNING_SECRET = 'test-signing-secret'
  })

  it('GET token pauses ParentStudent and creates audit', async () => {
    // Arrange - parent-student link exists
    prismaMock.parentStudent.findUnique.mockResolvedValue({ id: 'link-1', parentId: 'parent-1', studentId: 'student-1', status: 'active' })
    prismaMock.parentStudent.update.mockResolvedValue({ id: 'link-1', isPaused: true, pausedUntil: new Date('2026-05-01T00:00:00.000Z'), pauseReason: 'muted_via_alert_link' })

    // Generate a valid token
    const { generateMuteToken } = await import('@/lib/parent/signedLink')
    const token = generateMuteToken({ parentStudentId: 'link-1', studentId: 'student-1', muteDays: 7, tokenTTLSeconds: 60 })

    const { GET } = await import('@/app/api/parent/alerts/mute/route')
    const req = new Request('http://localhost/api/parent/alerts/mute?t=' + encodeURIComponent(token))

    // Act
    const res = await GET(req as any) as any

    // Assert - update called and audit logged
    expect(prismaMock.parentStudent.update).toHaveBeenCalled()
    expect(prismaMock.auditLog.create).toHaveBeenCalled()
  })
})
