import { processParentInactivityAlerts } from '@/worker/services/inactivityAlertWorker'

const mockParentFind = jest.fn()
jest.mock('@/lib/prisma', () => ({ prisma: { parentStudent: { findMany: (...a: any[]) => mockParentFind(...a) } } }))

const mockSendMail = jest.fn()
jest.mock('@/lib/mailer', () => ({ sendMailSafe: (...a: any[]) => Promise.resolve(mockSendMail(...a)) }))

const mockSendSms = jest.fn()
jest.mock('@/lib/sms', () => ({ sendSms: (...a: any[]) => Promise.resolve(mockSendSms(...a)) }))

const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn(() => ({ get: mockRedisGet, set: mockRedisSet })) }))

beforeEach(() => {
  mockParentFind.mockReset()
  mockSendMail.mockReset()
  mockSendSms.mockReset()
  mockRedisGet.mockReset()
  mockRedisSet.mockReset()
})

test('integration: parent inactivity alert flow', async () => {
  const old = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
  mockParentFind.mockResolvedValueOnce([
    { parentId: 'p1', studentId: 's1', parent: { name: 'Kiran', email: 'k@example.com', phone: '9000000001' }, student: { name: 'Sam', lastSessionDate: old } },
  ])
  mockRedisGet.mockResolvedValue(null)

  await processParentInactivityAlerts(new Date())

  expect(mockSendMail).toHaveBeenCalled()
  expect(mockSendSms).toHaveBeenCalled()
  expect(mockRedisSet).toHaveBeenCalled()
})
