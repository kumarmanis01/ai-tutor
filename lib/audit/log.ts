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
      // Keep `action` typed/admin-only. For legacy system events, retain
      // the string in `details.legacyAction` and leave `action` null to
      // avoid writing unknown enum labels into the DB.
      action:        ev.action ?? null,
      previousValue: ev.previousValue ?? null,
      newValue:      ev.newValue ?? null,
      reason:        ev.reason ?? null,
      details:       ev.details ?? null,
    }

    // For system events (action === null) prefer a raw INSERT via $executeRaw
    // to avoid Prisma enum/type validation issues in test/dev databases.
    if (ev.action == null) {
      const detailsJson = ev.details ? JSON.stringify(ev.details) : null
      // Use parameter binding to avoid SQL injection; Postgres will accept
      // a JSON string parameter for a JSON column.
      // Fire-and-forget raw insert; attach a rejection handler so we never throw.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const q: Promise<any> = db.$executeRaw`
        INSERT INTO "AuditLog" ("adminId", "targetEntity", "targetId", "action", "previousValue", "newValue", "reason", "ipAddress", "details", "createdAt")
        VALUES (
          ${ev.adminId ?? null},
          ${ev.targetEntity},
          ${ev.targetId},
          NULL,
          ${ev.previousValue ?? null}::jsonb,
          ${ev.newValue ?? null}::jsonb,
          ${ev.reason ?? null},
          ${ev.ipAddress ?? null},
          ${detailsJson}::jsonb,
          now()
        )
      `
      q.catch((rawErr: any) => logger?.warn?.('logAuditEvent: raw insert failed', { err: rawErr, event: ev }))
      return
    }
    if (ev.adminId != null) data.adminId = ev.adminId

    const p = db.auditLog.create({ data })
    if (p && typeof p.catch === 'function') {
      p.catch(async (err: any) => {
        // If the write failed due to an enum validation error (legacy action not present
        // in the DB enum), attempt to add the enum value and retry once. This helps
        // tests and dev environments where the DB enum may be out-of-sync with
        // in-repo constants. Be conservative: swallow errors and log warnings.
        const isEnumError = err && (err.name === 'PrismaClientValidationError' || (err.message && typeof err.message === 'string' && err.message.includes('invalid input value for enum')))
        // Only attempt to alter the enum when an explicit admin action was
        // provided (ev.action). For system events where action is null we
        // preserve the value in details.legacyAction and avoid mutating the
        // DB enum at runtime.
        if (isEnumError && ev.action && typeof ev.action === 'string') {
          try {
            // Try adding the enum label; if it already exists this may error — ignore.
            // Use $executeRawUnsafe to allow dynamic value insertion.
            // This operation is safe in test/dev; in production envs schema management
            // should be done via migrations.
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            await db.$executeRawUnsafe(`ALTER TYPE "AdminActionType" ADD VALUE '${String(ev.action).replace(/'/g, "''")}'`)
            // Retry the audit insert once
            await db.auditLog.create({ data })
            return
          } catch (err2) {
            logger?.warn?.('logAuditEvent: retry after enum update failed', { err: err2, event: ev })
            return
          }
        }
        logger?.warn?.('logAuditEvent: failed to write audit log', { err, event: ev })
      })
    }
  } catch (err) {
    logger?.warn?.('logAuditEvent: unexpected error', { err, event: ev })
  }
}

export default logAuditEvent
