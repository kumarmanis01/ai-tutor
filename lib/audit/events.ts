export const AuditEvents = {
  REGEN_JOB_LOCKED: 'REGEN_JOB_LOCKED',
  REGEN_JOB_TRIGGERED: 'REGEN_JOB_TRIGGERED',
  REGEN_JOB_CREATED: 'REGEN_JOB_CREATED',
  REGEN_JOB_STARTED: 'REGEN_JOB_STARTED',
  REGEN_JOB_COMPLETED: 'REGEN_JOB_COMPLETED',
  REGEN_JOB_FAILED: 'REGEN_JOB_FAILED',
} as const

export type AuditEventKey = typeof AuditEvents[keyof typeof AuditEvents]

// Usage: logAuditEvent(prisma, { action: AuditEvents.REGEN_JOB_CREATED, ... })
