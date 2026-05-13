/**
 * FILE OBJECTIVE:
 * - Lock the VALID_EVENT_TYPES allowlist in app/api/analytics/event/route.ts.
 * - Any addition or removal of event types MUST update this test.
 * - Ensures server-only event types are never accidentally added to the allowlist.
 *
 * EDIT LOG:
 * - 2026-04-21 | staff-engineer | Task F: allowlist lock test
 * - 2026-05-13T00:00:00Z | copilot | source EXPECTED_TYPES from STUDENT_ANALYTICS_EVENT_SET canonical registry
 */

// Mock dependencies so we can import the route without a DB or Redis connection
jest.mock('@/lib/prisma', () => ({ prisma: {} }))
jest.mock('@/lib/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), logAPI: jest.fn() } }))
jest.mock('@/lib/queues/analyticsQueue', () => ({ getAnalyticsQueue: jest.fn().mockReturnValue(null) }))

import { VALID_EVENT_TYPES } from '../../../app/api/analytics/event/route'
import { STUDENT_ANALYTICS_EVENT_SET } from '@/lib/analytics/events'

describe('VALID_EVENT_TYPES allowlist', () => {
  // Client allowlist is sourced from canonical student analytics registry.
  const EXPECTED_TYPES = STUDENT_ANALYTICS_EVENT_SET

  it('should contain exactly the expected event types', () => {
    expect(VALID_EVENT_TYPES).toEqual(EXPECTED_TYPES)
  })

  // Server-only events must never appear in the client allowlist
  const SERVER_ONLY_TYPES = [
    'ai_call',
    'safety_trigger',
    'safety_triggered',
    'hallucination_detected',
    'hallucination_blocked',
    'copy_paste_detected',
    'ingest_run',
    'ingest_run_retry',
    'weekly_question_health',
    'trial_start',
    'converted_to_paid',
    'whatsapp_opt_in',
    'whatsapp_opt_out',
    'whatsapp_message_sent',
  ]

  it.each(SERVER_ONLY_TYPES)('should NOT allow server-only type: %s', (type) => {
    expect(VALID_EVENT_TYPES.has(type)).toBe(false)
  })
})
