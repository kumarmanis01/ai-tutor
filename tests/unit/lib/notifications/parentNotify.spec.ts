import { jest } from '@jest/globals'

describe('parentNotify', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  it('sends email and whatsapp for SESSION_COMPLETE with topics and chapters', async () => {
    // Mock prisma user lookup
    jest.doMock('../../../lib/prisma', () => ({
      prisma: {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'student-1',
            name: 'Asha',
            parentEmail: 'parent@example.com',
            parentPhone: '',
            whatsappPhone: '+911234567890',
          }),
        },
      },
    }) as unknown as any)

    const sendEmailUnifiedSafeMock = jest.fn().mockResolvedValue(undefined) as unknown as any
    const sendWhatsAppMock = jest.fn().mockResolvedValue(undefined) as unknown as any

    jest.doMock('../../../lib/mail', () => ({ sendEmailUnifiedSafe: sendEmailUnifiedSafeMock }) as unknown as any)
    jest.doMock('../../../lib/whatsapp/sender', () => ({ sendWhatsAppSafe: sendWhatsAppMock }) as unknown as any)

    // Import after mocks
    const { notifyParent, DEFAULT_DASHBOARD_URL } = require('../../../lib/notifications/parentNotify')
    const { PARENT_NOTIF_EVENTS } = require('../../../lib/constants/mail')

    const payload = {
      event: PARENT_NOTIF_EVENTS.SESSION_COMPLETE,
      data: {
        topicName: 'Quadratic equations',
        subjectName: 'Math',
        sessionDate: '2026-05-17',
        dashboardUrl: DEFAULT_DASHBOARD_URL,
        xpEarned: 12,
        badges: ['Focus'],
        topicsTouched: [
          {
            topicId: 't1',
            topicName: 'Quadratic equations',
            chapterName: 'Polynomials',
            concepts: [
              { conceptId: 'c1', conceptName: 'roots', masteryAfter: 0.8, masteryDelta: 0.2 },
            ],
          },
        ],
        chaptersCompleted: [{ chapterId: 'ch1', chapterName: 'Polynomials', completed: true }],
      },
    } as const

    await notifyParent('student-1', payload as any)

    expect(sendEmailUnifiedSafeMock).toHaveBeenCalledTimes(1)
    const mailArgs = sendEmailUnifiedSafeMock.mock.calls[0][0] as any
    expect(mailArgs.to).toBe('parent@example.com')
    expect(mailArgs.html).toMatch(/Polynomials/)
    expect(mailArgs.html).toMatch(/Quadratic equations/)

    expect(sendWhatsAppMock).toHaveBeenCalledTimes(1)
  })
})
