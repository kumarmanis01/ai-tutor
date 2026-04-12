jest.useRealTimers()

describe('logger module', () => {
  const oldEnv = { ...process.env }
  let consoleLogSpy: jest.SpyInstance
  let consoleErrSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleErrSpy.mockRestore()
    process.env = { ...oldEnv }
  })

  it('sanitizes sensitive fields and routes output to console.log/info', () => {
    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'false'
    jest.resetModules()
    const { info } = require('@/lib/logger.js')

    info('test.event', { token: 'abc.def.ghi', email: 'foo@bar.com', rawAnswer: '42' })

    expect(consoleLogSpy).toHaveBeenCalled()
    const line = consoleLogSpy.mock.calls[0][0]
    const payload = JSON.parse(line)
    expect(payload.level).toBe('info')
    expect(payload.context.token).toBe('[REDACTED]')
    expect(payload.context.email).toBe('[REDACTED_EMAIL]')
    expect(payload.context.rawAnswer).toBe('[REDACTED_ANSWER]')
  })

  it('routes warn/error to stderr', () => {
    process.env.NODE_ENV = 'development'
    jest.resetModules()
    const { warn, error } = require('@/lib/logger.js')

    warn('warn.event', { some: 'value' })
    error('err.event', { some: 'value' })

    expect(consoleErrSpy).toHaveBeenCalled()
    // warn and error should call console.error
    expect(consoleErrSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('logger.subscribe and getLogs obey debug env', () => {
    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'true'
    jest.resetModules()
    const { logger } = require('@/lib/logger.js')

    const received: string[] = []
    const unsub = logger.subscribe((m: string) => received.push(m))

    logger.info('sub.test', { className: 'C' })

    expect(received.length).toBeGreaterThanOrEqual(1)
    const logs = logger.getLogs()
    expect(Array.isArray(logs)).toBe(true)

    unsub()
    logger.close()
  })

  it('logAPI pretty prints request/response metadata', async () => {
    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'true'
    jest.resetModules()
    const { logger } = require('@/lib/logger.js')

    const received: string[] = []
    const unsub = logger.subscribe((m: string) => received.push(m))

    // Fake Request/Response-like objects with clone().text()
    const req: any = {
      url: '/api/test',
      method: 'POST',
      clone: () => ({ text: async () => JSON.stringify({ a: 1, b: 2 }) }),
    }
    const res: any = {
      status: 200,
      clone: () => ({ text: async () => JSON.stringify({ ok: true }) }),
    }

    await logger.logAPI(req as any, res as any, { methodName: 'm' }, Date.now() - 50)

    expect(received.length).toBeGreaterThanOrEqual(1)
    const found = received.find((r) => r.includes('/api/test'))
    expect(found).toBeTruthy()

    unsub()
    logger.close()
  })

  it('respects LOG_LEVEL parse fallback and suppresses low-level logs', () => {
    // set an invalid LOG_LEVEL so parseLevel falls back to 'error'
    process.env.NODE_ENV = 'production'
    process.env.LOG_LEVEL = 'not-a-level'
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'false'
    process.env.WORKER_DEBUG = 'false'
    jest.resetModules()
    const { logger } = require('@/lib/logger.js')

    const received: string[] = []
    const unsub = logger.subscribe((m: string) => received.push(m))

    // debug should be suppressed because server min level is error
    logger.debug('should.suppress', { foo: 'bar' })
    expect(received.length).toBe(0)

    unsub()
    logger.close()
  })

  it('safeSerializeContext falls back on circular structures', () => {
    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_DEBUG_MODE = 'true'
    jest.resetModules()
    const { logger } = require('@/lib/logger.js')

    const received: string[] = []
    const unsub = logger.subscribe((m: string) => received.push(m))

    const a: any = {}
    a.self = a // circular

    logger.debug('circ.test', a)

    expect(received.length).toBeGreaterThanOrEqual(1)
    const entry = received[received.length - 1]
    expect(entry).toContain('circ.test')

    unsub()
    logger.close()
  })
})
