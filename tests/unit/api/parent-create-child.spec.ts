/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any */

jest.mock('@/lib/prisma', () => ({ prisma: require('../../helpers/prismaMock').prismaMock }));
jest.mock('@/lib/auth', () => ({ authOptions: {} }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), logAPI: jest.fn() } }));
jest.mock('@/lib/mailer', () => ({ sendMailSafe: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/sms', () => ({ sendSms: jest.fn().mockResolvedValue(undefined) }));
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { prismaMock, resetPrismaMock } from '../../helpers/prismaMock'
import '../../helpers/mockSession'

describe('Parent create-child API', () => {
  const requiredConsentScopes = [
    'DATA_PROCESSING',
    'AI_INTERACTION',
    'PARENT_NOTIFICATION',
    'COMMUNITY_FEATURES',
  ]

  beforeEach(() => {
    resetPrismaMock()
    ;(global as any).__TEST_SESSION__ = { user: { id: 'parent-1', role: 'parent', email: 'parent@example.test' } }
  })

  it('should return 409 when parent already has 3 active children', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(3)
    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Child', relationship: 'guardian', consentScopes: requiredConsentScopes }), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(409)
  })

  it('should create child with basic fields and link to parent', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))
    prismaMock.user.create.mockResolvedValue({ id: 'child-1', name: 'Child Name', grade: null, board: null, language: null, dateOfBirth: null } as any)
    prismaMock.parentStudent.create.mockResolvedValue({ id: 'link-1' } as any)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'parent', email: null, phone: null, name: 'Parent' } as any)
    prismaMock.consent.upsert.mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Child Name', email: 'child@example.test', relationship: 'mother', consentScopes: requiredConsentScopes }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any) as any
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.child).toBeDefined()
    expect(prismaMock.user.create).toHaveBeenCalled()
    expect(prismaMock.parentStudent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ relationship: 'mother' }) }))
    expect(prismaMock.consent.upsert).toHaveBeenCalledTimes(4)
  })

  it('should persist grade, board, medium (language) and dateOfBirth when provided', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock))
    prismaMock.user.create.mockResolvedValue({
      id: 'child-2',
      name: 'Priya',
      grade: '10',
      board: 'CBSE',
      language: 'en',
      dateOfBirth: new Date('2010-05-15'),
    } as any)
    prismaMock.parentStudent.create.mockResolvedValue({ id: 'link-2' } as any)
    prismaMock.user.findUnique.mockResolvedValue({ role: 'parent', email: null, phone: null, name: 'Parent' } as any)
    prismaMock.consent.upsert.mockResolvedValue({} as any)

    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Priya', grade: '10', board: 'CBSE', medium: 'en', dateOfBirth: '2010-05-15', relationship: 'guardian', consentScopes: requiredConsentScopes }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any) as any
    expect(res.status).toBe(201)

    // Verify user.create was called with grade/board/language/dateOfBirth
    const createCall = prismaMock.user.create.mock.calls[0][0] as any
    expect(createCall.data.grade).toBe('10')
    expect(createCall.data.board).toBe('CBSE')
    expect(createCall.data.language).toBe('en')
    expect(createCall.data.dateOfBirth).toBeInstanceOf(Date)
  })

  it('should return 400 when dateOfBirth is not a valid date string', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(0)
    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Child', dateOfBirth: 'not-a-date', relationship: 'father', consentScopes: requiredConsentScopes }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any) as any
    expect(res.status).toBe(400)
  })

  it('should return 400 when relationship is missing', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(0)
    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Child', consentScopes: requiredConsentScopes }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any) as any
    expect(res.status).toBe(400)
  })

  it('should return 400 when required consent scopes are missing', async () => {
    prismaMock.parentStudent.count.mockResolvedValue(0)
    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ name: 'Child', relationship: 'guardian', consentScopes: ['DATA_PROCESSING', 'AI_INTERACTION'] }),
      headers: { 'Content-Type': 'application/json' },
    })
    const res = await POST(req as any) as any
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(Array.isArray(data.missingScopes)).toBe(true)
    expect(data.missingScopes).toContain('PARENT_NOTIFICATION')
  })

  it('should return 401 when not authenticated', async () => {
    ;(global as any).__TEST_SESSION__ = null
    const { POST } = await import('@/app/api/parent/create-child/route')
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify({ name: 'Child', relationship: 'guardian', consentScopes: requiredConsentScopes }), headers: { 'Content-Type': 'application/json' } })
    const res = await POST(req as any) as any
    expect(res.status).toBe(401)
  })
})
