/* eslint-disable @typescript-eslint/no-require-imports */
import { jest } from '@jest/globals'

jest.mock('fs', () => ({ writeFileSync: jest.fn(), mkdirSync: jest.fn() }))
jest.mock('os', () => ({ hostname: () => 'local-host' }))
jest.mock('child_process', () => ({ spawn: jest.fn(() => ({ pid: 1234, on: jest.fn() })) }))

// Mock prisma and dependencies
jest.mock('../../../lib/prisma', () => ({ prisma: { workerLifecycle: { findMany: jest.fn(), update: jest.fn() }, auditLog: { create: jest.fn() }, $queryRawUnsafe: jest.fn(), $transaction: jest.fn() } }))
jest.mock('../../../worker/metrics-server', () => ({ startMetricsServer: jest.fn(), incJobsSpawned: jest.fn() }))
jest.mock('../../../worker/k8s-adapter', () => ({ createJobForWorker: jest.fn() }))
jest.mock('../../../src/jobs/analyticsJobs', () => ({ runAnalyticsJobs: jest.fn(async () => ({ success: true, durationMs: 10 })) }))

describe('orchestrator main', () => {
  test('exits when DATABASE_URL missing', async () => {
    const env = { ...process.env }
    delete process.env.DATABASE_URL
    delete process.env.REDIS_URL

    // require the orchestrator module in isolation - it will call process.exit(2)
    const spy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new Error('exit:' + code) }) as any)
    try {
      // Dynamically require the module inside isolated modules so errors are contained
      // require module and call exported main() to exercise startup checks
      const mod = require('../../../worker/orchestrator')
      let thrown: any = null
      try {
        await mod.main()
      } catch (e) {
        thrown = e
      }
      expect(thrown).toBeTruthy()
      expect(String(thrown)).toContain('exit:2')
    } finally {
      spy.mockRestore()
      process.env = env
    }
  })
})
