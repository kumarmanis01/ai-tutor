/**
 * Unit tests for `lib/audit/log.ts`
 */
import logAuditEvent from '@/lib/audit/log'

jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn() } }))
import { logger } from '@/lib/logger'

describe('logAuditEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('uses userId when actorId present and attaches .catch', () => {
    const catchFn = jest.fn()
    const createMock = jest.fn().mockReturnValue({ catch: catchFn })
    const db: any = { auditLog: { create: createMock } }

    const ev = { actorId: 'user-1', action: 'TEST', entityType: 'T', entityId: 'E', metadata: { foo: 'bar' } }

    expect(() => logAuditEvent(db, ev as any)).not.toThrow()
    expect(createMock).toHaveBeenCalledTimes(1)
    const arg = createMock.mock.calls[0][0]
    expect(arg).toHaveProperty('data')
    expect(arg.data.userId).toBe('user-1')
    expect(arg.data.details).toMatchObject({ foo: 'bar', entityType: 'T', entityId: 'E' })
    expect(catchFn).toHaveBeenCalledTimes(1)
  })

  test('creates details without userId when actorId absent', () => {
    const catchFn = jest.fn()
    const createMock = jest.fn().mockReturnValue({ catch: catchFn })
    const db: any = { auditLog: { create: createMock } }

    const ev = { action: 'NO_ACTOR', entityType: 'X', entityId: 'Y', metadata: { a: 1 } }

    expect(() => logAuditEvent(db, ev as any)).not.toThrow()
    expect(createMock).toHaveBeenCalledTimes(1)
    const arg = createMock.mock.calls[0][0]
    expect(arg.data.userId).toBeUndefined()
    expect(arg.data.details).toMatchObject({ a: 1, entityType: 'X', entityId: 'Y' })
  })

  test('falls back to relation form when first create throws', () => {
    const catchFn = jest.fn()
    const createMock = jest
      .fn()
      .mockImplementationOnce(() => { throw new Error('first fail') })
      .mockReturnValue({ catch: catchFn })
    const db: any = { auditLog: { create: createMock } }

    const ev = { actorId: 'u2', action: 'FALLBACK', metadata: {} }

    expect(() => logAuditEvent(db, ev as any)).not.toThrow()
    expect(createMock).toHaveBeenCalledTimes(2)
    const secondArg = createMock.mock.calls[1][0]
    expect(secondArg.data.user).toBeDefined()
    expect(secondArg.data.user.connect.id).toBe('u2')
    expect(catchFn).toHaveBeenCalledTimes(1)
  })

  test('does not throw and logs warn when both attempts fail', () => {
    const createMock = jest.fn().mockImplementation(() => { throw new Error('boom') })
    const db: any = { auditLog: { create: createMock } }

    const ev = { actorId: 'x', action: 'ERR', metadata: {} }

    expect(() => logAuditEvent(db, ev as any)).not.toThrow()
    expect(logger.warn).toHaveBeenCalled()
  })
})
