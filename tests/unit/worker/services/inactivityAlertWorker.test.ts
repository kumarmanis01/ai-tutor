import { processParentInactivityAlerts } from '@/worker/services/inactivityAlertWorker'

const mockRun = jest.fn()
jest.mock('@/worker/jobs/inactivityAlert', () => ({ runInactivityAlerts: () => mockRun() }))

beforeEach(() => {
  mockRun.mockReset()
})

test('delegates to canonical runInactivityAlerts implementation', async () => {
  mockRun.mockResolvedValue(1)
  await processParentInactivityAlerts(new Date())
  expect(mockRun).toHaveBeenCalled()
})
