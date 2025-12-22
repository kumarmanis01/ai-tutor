import { logger } from '@/lib/logger'

export type AuditEvent = {
  actorId?: string | null
  action: string
  entityType?: string | null
  entityId?: string | null
  metadata?: Record<string, any>
}

/**
 * Log an audit event using the provided prisma client.
 * This function is non-blocking: it triggers the write and attaches a rejection handler.
 * It never throws — internal errors are logged and swallowed so callers are not blocked.
 */
export function logAuditEvent(db: any, ev: AuditEvent) {
  try {
    const data: any = {
      userId: ev.actorId ?? null,
      action: ev.action,
      entityType: ev.entityType ?? null,
      entityId: ev.entityId ?? null,
      details: ev.metadata ?? {}
    }
    const p = db.auditLog.create({ data })
    if (p && typeof p.catch === 'function') {
      p.catch((err: any) => logger?.warn?.('logAuditEvent: failed to write audit log', { err, event: ev }))
    }
  } catch (err) {
    logger?.warn?.('logAuditEvent: unexpected error', { err, event: ev })
  }
}

export default logAuditEvent
