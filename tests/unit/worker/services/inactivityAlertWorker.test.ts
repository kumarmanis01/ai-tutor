import { processParentInactivityAlerts } from '@/worker/services/inactivityAlertWorker'

const mockFindMany = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentStudent: { findMany: (...a: any[]) => mockFindMany(...a) },
  },
}))

const mockSendMail = jest.fn()
jest.mock('@/lib/mailer', () => ({ sendMailSafe: (...a: any[]) => mockSendMail(...a) }))

const mockSendSms = jest.fn()
jest.mock('@/lib/sms', () => ({ sendSms: (...a: any[]) => mockSendSms(...a) }))

const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn(() => ({ get: mockRedisGet, set: mockRedisSet })) }))

beforeEach(() => {
  mockFindMany.mockReset()
  mockSendMail.mockReset()
  mockSendSms.mockReset()
  mockRedisGet.mockReset()
  mockRedisSet.mockReset()
})

test('sends alerts when child inactive beyond threshold', async () => {
  const oldDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)

  mockFindMany.mockResolvedValueOnce([
    { parentId: 'p1', studentId: 's1', parent: { name: 'Priya', email: 'p@example.com', phone: '9876543210' }, student: { name: 'Riya', lastSessionDate: oldDate } },
  ])

  // Redis: no mute, no last_sent
  mockRedisGet.mockResolvedValue(null)

  await processParentInactivityAlerts(new Date())

  expect(mockSendMail).toHaveBeenCalled()
  expect(mockSendSms).toHaveBeenCalled()
  expect(mockRedisSet).toHaveBeenCalled() // rate-limit key set
})
