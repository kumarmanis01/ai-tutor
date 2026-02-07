jest.mock('@/lib/prisma', () => ({ prisma: {
  systemSetting: { findUnique: jest.fn(({ where }) => Promise.resolve({ value: where.key === 'HYDRATION_DISABLED_NOTES' })) },
  hydrationJob: { findUnique: jest.fn(({ where }) => Promise.resolve({ id: where.id })) },
  executionJob: { findUnique: jest.fn() },
  jobExecutionLog: { create: jest.fn() },
  aIContentLog: { create: jest.fn() }
} }))

import { processContentJob } from '@/worker/processors/contentWorker'

describe('contentWorker admin kill-switch', () => {
  test('per-job-type disable causes worker to fail early', async () => {
    const job = { id: 'bull-1', data: { payload: { jobId: 'h-1' }, type: 'NOTES' } }
    await expect(processContentJob(job as any)).rejects.toThrow('HYDRATION_DISABLED_NOTES')
  })
})
