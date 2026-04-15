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
    const baseDetails = (ev as any).details ?? (ev as any).metadata ?? ev.details ?? {}

    // Merge entityType/entityId into details for legacy consumers/tests
    // so callers can query by `details->>'entityId'` even when the
    // typed column is `targetId`.
    const detailsObj: Record<string, unknown> = { ...(baseDetails as Record<string, unknown> || {}) }
    if (targetEntity && !(detailsObj as any).entityType) (detailsObj as any).entityType = targetEntity
    if (targetId && !(detailsObj as any).entityId) (detailsObj as any).entityId = targetId

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
      details:       Object.keys(detailsObj).length ? detailsObj : null,
    }

    // Decide `action` value: prefer explicit `ev.action`. Do NOT write
    // legacy action strings into the typed `action` enum column. Preserve
    // legacyAction inside `details` for backward-compatible queries.
    const legacyAction = (baseDetails as any)?.legacyAction
    const finalAction = ev.action ?? null

    if (adminId != null) data.adminId = adminId

    // Ensure the Prisma client has the auditLog model available before
    // attempting to write. In some test/mocking scenarios the client may
    // be partially mocked and `auditLog.create` could be undefined which
    // would otherwise throw synchronously.
    if (!db || !db.auditLog || typeof db.auditLog.create !== 'function') {
      try { logger?.warn?.('logAuditEvent: prisma.auditLog.create not available; skipping audit', { event: ev }) } catch {}
      return Promise.resolve(null)
    }

    try {
      // Always write `action` as the explicit enum value or null. The
      // legacy action label (if any) remains inside `details.legacyAction`.
      const p = db.auditLog.create({ data: { ...data, action: finalAction } })
      if (p && typeof p.catch === 'function') {
        p.catch((err: any) => logger?.warn?.('logAuditEvent: failed to write audit log', { err, event: ev }))
      }
      return p
    } catch (err) {
      try { logger?.warn?.('logAuditEvent: create threw', { err, event: ev }) } catch {}
      return Promise.resolve(null)
    }
  } catch (err) {
    try { logger?.warn?.('logAuditEvent: unexpected error', { err, event: ev }) } catch {}
    return Promise.resolve(null)
  }
}

export default logAuditEvent
