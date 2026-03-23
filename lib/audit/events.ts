/**
 * Legacy system-event action strings for regeneration jobs.
 * These are NOT AdminActionType enum values -- regeneration events are system events
 * (action: null) and the string is stored in details.legacyAction.
 *
 * @deprecated Pass action: null and include legacyAction in details when calling
 *   logAuditEvent. Use AdminActionType from @prisma/client for typed admin actions.
 */
export const AuditEvents = {
  REGEN_JOB_LOCKED:    'REGEN_JOB_LOCKED',
  REGEN_JOB_TRIGGERED: 'REGEN_JOB_TRIGGERED',
  REGEN_JOB_CREATED:   'REGEN_JOB_CREATED',
  REGEN_JOB_STARTED:   'REGEN_JOB_STARTED',
  REGEN_JOB_COMPLETED: 'REGEN_JOB_COMPLETED',
  REGEN_JOB_FAILED:    'REGEN_JOB_FAILED',
} as const

export type AuditEventKey = typeof AuditEvents[keyof typeof AuditEvents]
