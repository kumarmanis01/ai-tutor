type AnalyticsEvent = {
  eventType: 'lesson_viewed' | 'lesson_completed' | 'quiz_attempted' | 'quiz_passed'
  userId?: string | null
  courseId?: string | null
  lessonIdx?: number | null
  metadata?: any
}

const ALLOWED = new Set(['lesson_viewed', 'lesson_completed', 'quiz_attempted', 'quiz_passed'])

let queue: AnalyticsEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
const FLUSH_INTERVAL = 2000 // 2s debounce
const MAX_BATCH = 50

function sendBatch(events: AnalyticsEvent[]) {
  if (!events || events.length === 0) return
  const payload = events.map((e) => ({
    eventType: e.eventType,
    userId: e.userId ?? null,
    courseId: e.courseId ?? null,
    lessonIdx: typeof e.lessonIdx === 'number' ? e.lessonIdx : null,
    metadata: e.metadata ?? {},
  }))

  const body = JSON.stringify(payload)

  // Prefer sendBeacon for background reliability
  try {
    if (typeof navigator !== 'undefined' && typeof (navigator as any).sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      ;(navigator as any).sendBeacon('/api/analytics/event', blob)
      return
    }
  } catch {
    // fallthrough to fetch
  }

  // Non-blocking fetch with keepalive where available
  try {
    fetch('/api/analytics/event', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
  } catch {
    // ignore
  }
}

export function flushEvents() {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const batch = queue.splice(0, queue.length)
  // send in chunks of MAX_BATCH
  while (batch.length > 0) {
    const chunk = batch.splice(0, MAX_BATCH)
    sendBatch(chunk)
  }
}

function scheduleFlush() {
  if (timer) return
  timer = setTimeout(() => {
    timer = null
    flushEvents()
  }, FLUSH_INTERVAL)
}

function enqueue(event: AnalyticsEvent) {
  if (!ALLOWED.has(event.eventType)) return
  queue.push(event)
  if (queue.length >= MAX_BATCH) {
    flushEvents()
  } else {
    scheduleFlush()
  }
}

export function trackEvent(event: AnalyticsEvent) {
  try {
    enqueue(event)
  } catch {
    // never throw from analytics
  }
}

export function trackLessonViewed(opts: { userId?: string; courseId?: string; lessonIdx?: number; metadata?: any }) {
  trackEvent({ eventType: 'lesson_viewed', userId: opts.userId ?? null, courseId: opts.courseId ?? null, lessonIdx: opts.lessonIdx ?? null, metadata: opts.metadata })
}

export function trackLessonCompleted(opts: { userId?: string; courseId?: string; lessonIdx?: number; metadata?: any }) {
  trackEvent({ eventType: 'lesson_completed', userId: opts.userId ?? null, courseId: opts.courseId ?? null, lessonIdx: opts.lessonIdx ?? null, metadata: opts.metadata })
}

export function trackQuizAttempted(opts: { userId?: string; courseId?: string; lessonIdx?: number; metadata?: any }) {
  trackEvent({ eventType: 'quiz_attempted', userId: opts.userId ?? null, courseId: opts.courseId ?? null, lessonIdx: opts.lessonIdx ?? null, metadata: opts.metadata })
}

export function trackQuizPassed(opts: { userId?: string; courseId?: string; lessonIdx?: number; metadata?: any }) {
  trackEvent({ eventType: 'quiz_passed', userId: opts.userId ?? null, courseId: opts.courseId ?? null, lessonIdx: opts.lessonIdx ?? null, metadata: opts.metadata })
}

// For tests
export function _getQueueLength() { return queue.length }
export function _resetForTests() { queue = []; if (timer) { clearTimeout(timer); timer = null } }

const analyticsClient = { trackLessonViewed, trackLessonCompleted, trackQuizAttempted, trackQuizPassed, flushEvents }
export default analyticsClient
