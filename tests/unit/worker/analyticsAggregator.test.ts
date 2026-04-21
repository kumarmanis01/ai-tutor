/**
 * FILE OBJECTIVE:
 * - Unit tests for worker/services/analyticsAggregator.ts
 * - Validates rollup computation: views, completions, avgTimePerLesson,
 *   completionRate, uniqueUsers, and courseId bucketing.
 * - Uses __TEST_PRISMA__ injection (no live DB required).
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | Task F: aggregator rollup unit tests
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { aggregateDay } from '../../../worker/services/analyticsAggregator'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FakeEvent = {
  eventType: string
  courseId: string | null
  lessonIdx: number | null
  metadata: Record<string, unknown>
  userId: string | null
}

function makePrisma(events: FakeEvent[]) {
  const upsertMock = jest.fn().mockResolvedValue({})
  const findManyMock = jest.fn().mockResolvedValue(events)
  return {
    analyticsEvent: { findMany: findManyMock },
    analyticsDailyAggregate: { upsert: upsertMock },
    _upsertMock: upsertMock,
    _findManyMock: findManyMock,
  }
}

function withPrisma<T>(db: any, fn: () => Promise<T>): Promise<T> {
  ;(global as any).__TEST_PRISMA__ = db
  return fn().finally(() => {
    delete (global as any).__TEST_PRISMA__
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyticsAggregator.aggregateDay', () => {
  const day = new Date('2026-04-20T12:00:00Z')

  it('should count lesson_viewed and lesson_completed per course', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c1', lessonIdx: 1, metadata: {}, userId: 'u1' },
      { eventType: 'lesson_viewed', courseId: 'c1', lessonIdx: 2, metadata: {}, userId: 'u2' },
      { eventType: 'lesson_completed', courseId: 'c1', lessonIdx: 1, metadata: {}, userId: 'u1' },
    ]
    const db = makePrisma(events)

    const result = await withPrisma(db, () => aggregateDay(day))

    expect(result).toContain('c1')
    const call = db._upsertMock.mock.calls[0][0]
    expect(call.create.totalViews).toBe(2)
    expect(call.create.totalCompletions).toBe(1)
  })

  it('should compute completionRate as completions / views', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c2', lessonIdx: 1, metadata: {}, userId: 'u1' },
      { eventType: 'lesson_viewed', courseId: 'c2', lessonIdx: 2, metadata: {}, userId: 'u1' },
      { eventType: 'lesson_completed', courseId: 'c2', lessonIdx: 1, metadata: {}, userId: 'u1' },
    ]
    const db = makePrisma(events)

    await withPrisma(db, () => aggregateDay(day))

    const call = db._upsertMock.mock.calls[0][0]
    expect(call.create.completionRate).toBeCloseTo(0.5)
  })

  it('should set completionRate to null when there are no views', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_completed', courseId: 'c3', lessonIdx: 1, metadata: {}, userId: 'u1' },
    ]
    const db = makePrisma(events)

    await withPrisma(db, () => aggregateDay(day))

    const call = db._upsertMock.mock.calls[0][0]
    expect(call.create.completionRate).toBeNull()
  })

  it('should average timeSpent from metadata', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c4', lessonIdx: 1, metadata: { timeSpent: 60 }, userId: 'u1' },
      { eventType: 'lesson_viewed', courseId: 'c4', lessonIdx: 2, metadata: { timeSpent: 120 }, userId: 'u2' },
    ]
    const db = makePrisma(events)

    await withPrisma(db, () => aggregateDay(day))

    const call = db._upsertMock.mock.calls[0][0]
    expect(call.create.avgTimePerLesson).toBeCloseTo(90)
  })

  it('should count uniqueUsers correctly', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c5', lessonIdx: 1, metadata: {}, userId: 'u1' },
      { eventType: 'lesson_viewed', courseId: 'c5', lessonIdx: 2, metadata: {}, userId: 'u1' },  // same user, second event
      { eventType: 'lesson_viewed', courseId: 'c5', lessonIdx: 3, metadata: {}, userId: 'u2' },
    ]
    const db = makePrisma(events)

    await withPrisma(db, () => aggregateDay(day))

    const call = db._upsertMock.mock.calls[0][0]
    expect(call.create.uniqueUsers).toBe(2)  // u1 and u2 deduplicated
  })

  it('should bucket events by courseId and return all courseIds', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'cA', lessonIdx: 1, metadata: {}, userId: 'u1' },
      { eventType: 'lesson_viewed', courseId: 'cB', lessonIdx: 1, metadata: {}, userId: 'u2' },
      { eventType: 'lesson_completed', courseId: 'cA', lessonIdx: 1, metadata: {}, userId: 'u1' },
    ]
    const db = makePrisma(events)

    const result = await withPrisma(db, () => aggregateDay(day))

    expect(result).toHaveLength(2)
    expect(result).toContain('cA')
    expect(result).toContain('cB')
    expect(db._upsertMock).toHaveBeenCalledTimes(2)
  })

  it('should use "unknown" courseId for events with null courseId', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: null, lessonIdx: 1, metadata: {}, userId: 'u1' },
    ]
    const db = makePrisma(events)

    const result = await withPrisma(db, () => aggregateDay(day))

    expect(result).toContain('unknown')
  })

  it('should return empty array when there are no events', async () => {
    const db = makePrisma([])

    const result = await withPrisma(db, () => aggregateDay(day))

    expect(result).toHaveLength(0)
    expect(db._upsertMock).not.toHaveBeenCalled()
  })

  it('should be idempotent -- upsert is called, not insert', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c6', lessonIdx: 1, metadata: {}, userId: 'u1' },
    ]
    const db = makePrisma(events)

    await withPrisma(db, () => aggregateDay(day))
    // Run again with the same data (simulates re-run)
    await withPrisma(db, () => aggregateDay(day))

    // Both runs call upsert (not create), so re-running is safe
    expect(db._upsertMock).toHaveBeenCalledTimes(2)
    db._upsertMock.mock.calls.forEach((call: any) => {
      expect(call[0]).toHaveProperty('where')
      expect(call[0]).toHaveProperty('update')
      expect(call[0]).toHaveProperty('create')
    })
  })

  it('should swallow upsert errors and still return processed courseIds', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c7', lessonIdx: 1, metadata: {}, userId: 'u1' },
    ]
    const db = makePrisma(events)
    db._upsertMock.mockRejectedValue(new Error('DB connection lost'))

    // Should not throw
    const result = await withPrisma(db, () => aggregateDay(day))

    expect(result).toContain('c7')  // still returns the bucket
  })

  it('should ignore non-numeric or NaN timeSpent values', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c8', lessonIdx: 1, metadata: { timeSpent: 'bad' }, userId: 'u1' },
      { eventType: 'lesson_viewed', courseId: 'c8', lessonIdx: 2, metadata: { timeSpent: NaN }, userId: 'u2' },
    ]
    const db = makePrisma(events)

    await withPrisma(db, () => aggregateDay(day))

    const call = db._upsertMock.mock.calls[0][0]
    expect(call.create.avgTimePerLesson).toBeNull()
  })

  it('should not count userId null in uniqueUsers', async () => {
    const events: FakeEvent[] = [
      { eventType: 'lesson_viewed', courseId: 'c9', lessonIdx: 1, metadata: {}, userId: null },
      { eventType: 'lesson_viewed', courseId: 'c9', lessonIdx: 2, metadata: {}, userId: null },
    ]
    const db = makePrisma(events)

    await withPrisma(db, () => aggregateDay(day))

    const call = db._upsertMock.mock.calls[0][0]
    expect(call.create.uniqueUsers).toBe(0)
  })
})
