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
    // Prefer a flat `userId` if the Prisma model exposes that column.
    // Some schemas expose a `user` relation instead; we'll attempt userId first
    // and fall back to a `user: { connect: { id } }` shape when necessary.
    // Compose details payload — include entityType/entityId inside details
    const detailsPayload = Object.assign({}, ev.metadata ?? {})
    if (ev.entityType) detailsPayload.entityType = ev.entityType
    if (ev.entityId) detailsPayload.entityId = ev.entityId

    const data: any = {
      action: ev.action,
      details: detailsPayload
    }

    // First try: include userId directly when present
    let p: any = null
    try {
      if (ev.actorId != null) data.userId = ev.actorId
      p = db.auditLog.create({ data })
      if (p && typeof p.catch === 'function') {
        p.catch((err: any) => logger?.warn?.('logAuditEvent: failed to write audit log', { err, event: ev }))
      }
      return
    } catch {
      // If Prisma rejects unknown argument (e.g., `userId` not present), try relation form
      try {
        const alt: any = {
          action: ev.action,
          entityType: ev.entityType ?? null,
          entityId: ev.entityId ?? null,
          details: ev.metadata ?? {}
        }
        if (ev.actorId != null) {
          alt.user = { connect: { id: ev.actorId } }
        }
        p = db.auditLog.create({ data: alt })
        if (p && typeof p.catch === 'function') {
          p.catch((e: any) => logger?.warn?.('logAuditEvent: failed to write audit log (alt)', { err: e, event: ev }))
        }
        return
      } catch (err2) {
        logger?.warn?.('logAuditEvent: unexpected error', { err: err2, event: ev })
        return
      }
    }
  } catch (err) {
    logger?.warn?.('logAuditEvent: unexpected error', { err, event: ev })
  }
}

export default logAuditEvent
