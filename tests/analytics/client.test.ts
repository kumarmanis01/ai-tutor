import * as client from '@/lib/analytics/client'

describe('client analytics emitter', () => {
  beforeEach(() => {
    client._resetForTests()
    ;(global as any).fetch = jest.fn().mockResolvedValue({ ok: true })
    ;(global as any).navigator = (global as any).navigator ?? {}
    ;(global as any).navigator.sendBeacon = undefined
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.resetAllMocks()
  })

  it('batches events and sends after debounce', async () => {
    client.trackLessonViewed({ userId: 'u1', courseId: 'c1', lessonIdx: 1 })
    client.trackLessonCompleted({ userId: 'u1', courseId: 'c1', lessonIdx: 1 })
    expect(client._getQueueLength()).toBe(2)
    // advance timers past FLUSH_INTERVAL
    jest.advanceTimersByTime(2100)
    // allow microtasks
    await Promise.resolve()
    expect((global as any).fetch).toHaveBeenCalled()
    expect(client._getQueueLength()).toBe(0)
  })

  it('uses sendBeacon when available', async () => {
    const sendBeacon = jest.fn()
    ;(global as any).navigator.sendBeacon = sendBeacon
    client.trackQuizAttempted({ userId: 'u2', courseId: 'c2', lessonIdx: 2 })
    jest.advanceTimersByTime(2100)
    await Promise.resolve()
    expect(sendBeacon).toHaveBeenCalled()
  })
})
