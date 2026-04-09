import { processReadinessDropAlerts } from '@/worker/services/readinessDropWorker'

const mockParentFind = jest.fn()
const mockPlansFind = jest.fn()
const mockSubjectDefsFind = jest.fn()
jest.mock('@/lib/prisma', () => ({
  prisma: {
    parentStudent: { findMany: (...a: any[]) => mockParentFind(...a) },
    learningPlan: { findMany: (...a: any[]) => mockPlansFind(...a) },
    subjectDef: { findMany: (...a: any[]) => mockSubjectDefsFind(...a) },
  },
}))

const mockRedisGet = jest.fn()
const mockRedisSet = jest.fn()
jest.mock('@/lib/redis', () => ({ getRedis: jest.fn(() => ({ get: mockRedisGet, set: mockRedisSet })) }))

const mockCompute = jest.fn()
jest.mock('@/lib/student/examReadiness', () => ({ computeReadinessScore: (...a: any[]) => mockCompute(...a) }))

const mockSendMail = jest.fn()
jest.mock('@/lib/mailer', () => ({ sendMailSafe: (...a: any[]) => mockSendMail(...a) }))

const mockSendSms = jest.fn()
jest.mock('@/lib/sms', () => ({ sendSms: (...a: any[]) => mockSendSms(...a) }))

beforeEach(() => {
  mockParentFind.mockReset()
  mockPlansFind.mockReset()
  mockSubjectDefsFind.mockReset()
  mockRedisGet.mockReset()
  mockRedisSet.mockReset()
  mockCompute.mockReset()
  mockSendMail.mockReset()
  mockSendSms.mockReset()
})

test('detects readiness drop and notifies parent', async () => {
  const studentId = 's1'
  const parentId = 'p1'
  const subjectId = 'sub1'
  const examDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

  mockParentFind.mockResolvedValueOnce([{ parentId, studentId, parent: { name: 'Ajay', email: 'a@example.com', phone: '9000000000' } }])
  mockPlansFind.mockResolvedValueOnce([{ studentId, subjectId, examDate }])
  mockSubjectDefsFind.mockResolvedValueOnce([{ id: subjectId, name: 'Mathematics' }])

  // Redis snapshot 7 days ago = 80
  mockRedisGet.mockImplementation(async (key: string) => {
    if (key.includes('readiness:history')) return '80'
    return null
  })

  // Current readiness = 65
  mockCompute.mockResolvedValueOnce({ score: 65, label: 'Needs Work', chapters: [] })

  await processReadinessDropAlerts(new Date())

  expect(mockSendMail).toHaveBeenCalled()
  expect(mockSendSms).toHaveBeenCalled()
  // Rate-limit keys set
  expect(mockRedisSet).toHaveBeenCalled()
})
