import { logger } from '@/lib/logger'
import { AdminActionType } from '@prisma/client'

export type AuditEvent = {
  adminId?:      string | null          // who performed the action (null = system)
  targetEntity:  string                 // required: 'User' | 'Worker' | 'HydrationJob' | etc.
  targetId:      string                 // required: ID of the affected entity
  action?:       AdminActionType | null // typed enum; null for system/non-admin events
  previousValue?: Record<string, unknown>
  newValue?:     Record<string, unknown>
  reason?:       string
  details?:      Record<string, unknown> // legacy metadata / legacyAction for system events
}

/**
 * Log an audit event using the provided prisma client.
 * Non-blocking: fires and attaches a rejection handler. Never throws.
 *
 * For admin actions:   pass action (AdminActionType), adminId, previousValue/newValue, reason.
 * For system events:   pass action: null, details: { legacyAction: '...' }.
 */
export function logAuditEvent(db: any, ev: AuditEvent) {
  try {
    const data: Record<string, unknown> = {
      targetEntity:  ev.targetEntity,
      targetId:      ev.targetId,
      action:        ev.action ?? null,
      previousValue: ev.previousValue ?? null,
      newValue:      ev.newValue ?? null,
      reason:        ev.reason ?? null,
      details:       ev.details ?? null,
    }
    if (ev.adminId != null) data.adminId = ev.adminId

    const p = db.auditLog.create({ data })
    if (p && typeof p.catch === 'function') {
      p.catch((err: any) =>
        logger?.warn?.('logAuditEvent: failed to write audit log', { err, event: ev })
      )
    }
  } catch (err) {
    logger?.warn?.('logAuditEvent: unexpected error', { err, event: ev })
  }
}

export default logAuditEvent
