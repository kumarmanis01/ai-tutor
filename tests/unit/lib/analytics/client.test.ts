import analyticsClient, {
  trackEvent,
  trackLessonViewed,
  _getQueueLength,
  _resetForTests,
  flushEvents,
} from '@/lib/analytics/client';

describe('lib/analytics/client', () => {
  beforeEach(() => {
    _resetForTests();
  });

  it('enqueues lesson_viewed and exposes queue length', () => {
    expect(_getQueueLength()).toBe(0);
    trackLessonViewed({ userId: 'u1', courseId: 'c1', lessonIdx: 2 });
    expect(_getQueueLength()).toBe(1);
  });

  it('ignores disallowed event types', () => {
    // @ts-expect-error runtime test: inject an unknown eventType
    trackEvent({ eventType: 'unknown_event' });
    expect(_getQueueLength()).toBe(0);
  });

  it('flushEvents empties the queue without throwing', async () => {
    trackLessonViewed({ userId: 'u2' });
    expect(_getQueueLength()).toBe(1);
    await flushEvents();
    expect(_getQueueLength()).toBe(0);
  });
});
