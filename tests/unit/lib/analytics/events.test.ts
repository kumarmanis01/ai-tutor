/**
 * FILE OBJECTIVE:
 * - Unit tests for canonical analytics event constants.
 * - Guards uniqueness and required student/parent/admin event membership.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/analytics/events.test.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-12T00:00:00Z | copilot | add coverage for analytics event registry constants
 */

import {
  ALL_ANALYTICS_EVENT_SET,
  ANALYTICS_EVENTS,
  STUDENT_ANALYTICS_EVENT_SET,
  PARENT_ANALYTICS_EVENT_SET,
  ADMIN_ANALYTICS_EVENT_SET,
} from '@/lib/analytics/events'

describe('analytics event registry', () => {
  it('should keep all events unique across all groups', () => {
    const allValues = Object.values(ANALYTICS_EVENTS.STUDENT)
      .concat(Object.values(ANALYTICS_EVENTS.PARENT))
      .concat(Object.values(ANALYTICS_EVENTS.ADMIN))

    expect(new Set(allValues).size).toBe(allValues.length)
    expect(ALL_ANALYTICS_EVENT_SET.size).toBe(allValues.length)
  })

  it('should include required representative student events', () => {
    expect(STUDENT_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.STUDENT.AUTH_SIGNIN)).toBe(true)
    expect(STUDENT_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.STUDENT.SESSION_START)).toBe(true)
    expect(STUDENT_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.STUDENT.APP_OPEN)).toBe(true)
    expect(STUDENT_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.STUDENT.SUBJECT_SELECTED)).toBe(true)
  })

  it('should include required representative parent events', () => {
    expect(PARENT_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.PARENT.LINKED)).toBe(true)
    expect(PARENT_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.PARENT.LEARNING_PATH_CHANGED)).toBe(true)
    expect(PARENT_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.PARENT.APP_CLOSE)).toBe(true)
  })

  it('should include required representative admin events', () => {
    expect(ADMIN_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.ADMIN.CONTENT_GENERATION_SUCCESS)).toBe(true)
    expect(ADMIN_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.ADMIN.HEALTH_CHANGES)).toBe(true)
    expect(ADMIN_ANALYTICS_EVENT_SET.has(ANALYTICS_EVENTS.ADMIN.CONTENT_APPROVE)).toBe(true)
  })
})
