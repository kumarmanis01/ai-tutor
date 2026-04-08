jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}))

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }))

// Mock S3 client
const sendMock = jest.fn()
jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: function () {
      return { send: sendMock }
    },
    PutObjectCommand: function PutObjectCommand() {
      return {}
    },
  }
})

import { prisma } from '@/lib/prisma'
import runAuditArchivalCycle from '@/worker/services/auditArchivalWorker'

describe('auditArchivalWorker', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('archives eligible audit logs and marks them archived', async () => {
    const oldDate = new Date(Date.now() - 366 * 24 * 60 * 60 * 1000)
    const rows = [
      { id: 'a1', createdAt: oldDate, adminId: null, targetEntity: 'User', targetId: 'u1', action: null, previousValue: null, newValue: null, reason: null, ipAddress: null, details: null },
    ]

    ;(prisma.auditLog.findMany as jest.Mock).mockResolvedValue(rows)
    ;(prisma.auditLog.update as jest.Mock).mockResolvedValue({ id: 'a1', archived: true })
    sendMock.mockResolvedValue({})

    const result = await runAuditArchivalCycle()
    expect(result.archived).toBe(1)
    expect(prisma.auditLog.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1' } }))
    expect(sendMock).toHaveBeenCalled()
  })
})
