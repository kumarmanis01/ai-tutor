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
  ipAddress?:    string | null          // optional client IP for admin actions
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
    // Normalize legacy/alternate keys: support actorId/entityType/entityId and metadata
    const adminId = (ev as any).adminId ?? (ev as any).actorId ?? null
    const targetEntity = (ev as any).targetEntity ?? (ev as any).entityType ?? null
    const targetId = (ev as any).targetId ?? (ev as any).entityId ?? null
    const details = (ev as any).details ?? (ev as any).metadata ?? ev.details ?? null

    const data: Record<string, unknown> = {
      targetEntity,
      targetId,
      // Keep `action` typed/admin-only. For legacy system events, retain
      // the string in `details.legacyAction` and leave `action` null to
      // avoid writing unknown enum labels into the DB.
      action:        ev.action ?? null,
      previousValue: ev.previousValue ?? null,
      newValue:      ev.newValue ?? null,
      reason:        ev.reason ?? null,
      details:       details ?? null,
    }

    // Decide `action` value: prefer explicit `ev.action`, otherwise if the
    // caller provided a legacy action in `details.legacyAction` use that so
    // tests and consumers can query by action enums (e.g. 'REGEN_JOB_STARTED').
    const legacyAction = details && (details as any).legacyAction
    const finalAction = ev.action ?? (typeof legacyAction === 'string' ? (legacyAction as any) : null)

    if (adminId != null) data.adminId = adminId

    // Always use Prisma create to insert audit logs. This keeps behavior
    // consistent across environments and avoids fragile raw SQL binding.
    try {
      const p = db.auditLog.create({ data: { ...data, action: finalAction } })
      if (p && typeof p.catch === 'function') {
        p.catch((err: any) => logger?.warn?.('logAuditEvent: failed to write audit log', { err, event: ev }))
      }
      return p
    } catch (err) {
      logger?.warn?.('logAuditEvent: create threw', { err, event: ev })
      return Promise.resolve(null)
    }
  } catch (err) {
    logger?.warn?.('logAuditEvent: unexpected error', { err, event: ev })
  }
}

export default logAuditEvent
