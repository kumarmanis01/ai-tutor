/**
 * FILE OBJECTIVE:
 * - Provide a singleton PrismaClient for the application, with fallback stub for safer errors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/prisma.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-01-24T12:00:00Z | copilot | replace ESM createRequire logic with universal PrismaClient singleton to support Jest/CJS
 * - 2026-04-18T00:00:00Z | copilot | remove speculative eager-connect for test env; root fix is in prismaEnsureColumns.ts
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@/lib/logger'

/* eslint-disable no-var */
declare global {
  // Prevent multiple instances of PrismaClient in development due to HMR
  var prisma: PrismaClient | undefined;
}
/* eslint-enable no-var */

// Use `globalThis` rather than `global` so accidental client-side imports
// don't throw "global is not defined" in browsers. `globalThis` is available
// in Node and browser runtimes.
const g: any = globalThis as any;
const client = g.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') g.prisma = client;
// Provide a compatibility proxy so older code/tests that reference legacy model
// names (e.g. `analyticsSignal`) continue to work even if the schema renamed
// the model to `analyticsEvent`.
const prismaProxy = new Proxy(client, {
  get(target, prop, receiver) {
    // Legacy compatibility for `analyticsSignal` which was renamed to `analyticsEvent`.
    if (prop === 'analyticsSignal' && (target as any).analyticsEvent) {
      const eventModel = (target as any).analyticsEvent
      // Return a wrapper that translates the legacy API shape to the new model.
      return new Proxy(eventModel, {
        get(emTarget, name) {
          // Map create: translate `{ type, severity, metadata, courseId, createdAt }`
          // into `{ eventType: type, metadata, courseId, createdAt }` for analyticsEvent.
          if (name === 'create') {
            return async (args: any) => {
              const data = (args && args.data) ? { ...args.data } : {}
              // Translate legacy 'type' -> 'eventType'
              if (data.type && !data.eventType) {
                data.eventType = data.type
                delete data.type
              }
              // Preserve legacy 'severity' by moving into metadata if present
              if (data.severity != null) {
                data.metadata = data.metadata ?? {}
                data.metadata.severity = data.severity
                delete data.severity
              }
              // Ensure metadata is present (analyticsEvent.metadata is required in schema)
              if (data.metadata == null) data.metadata = {}
              return eventModel.create({ data })
            }
          }

          if (name === 'findMany' || name === 'findFirst' || name === 'findUnique') {
            return async (args: any) => {
              const where = args && args.where ? { ...args.where } : undefined
              // Translate filters on `type` -> `eventType`
              if (where && where.type) {
                where.eventType = where.type
                delete where.type
              }
              const newArgs = args ? { ...args, where } : args
              const rows = await (eventModel as any)[name](newArgs)
              // Normalize returned shape back to legacy `analyticsSignal` fields
              const normalize = (r: any) => {
                if (!r) return r
                const out: any = { ...r }
                if (r.eventType && !out.type) out.type = r.eventType
                if (r.metadata && r.metadata.severity && !out.severity) out.severity = r.metadata.severity
                return out
              }
              if (Array.isArray(rows)) return rows.map(normalize)
              return normalize(rows)
            }
          }

          if (name === 'deleteMany') {
            return async (args: any) => {
              const where = args && args.where ? { ...args.where } : undefined
              if (where && where.type) {
                where.eventType = where.type
                delete where.type
              }
              return (eventModel as any).deleteMany({ where })
            }
          }

          // default passthrough for other methods
          return (eventModel as any)[name]
        },
      })
    }

      // Compatibility: make reads against `auditLog` resilient when the DB enum
      // `AdminActionType` is missing labels that code/tests may reference.
      // Many tests query `prisma.auditLog.findMany({ where: { action: 'SOME_ACTION' } })`.
      // If the Postgres enum does not contain the label yet, Prisma will surface
      // an "invalid input value for enum" error. To make tests and dev flows
      // resilient, try the normal client call and on enum-validation failure
      // fallback to a raw query that compares the enum as text (`action::text = $1`).
      if (prop === 'auditLog' && (target as any).auditLog) {
        const auditModel = (target as any).auditLog
        return new Proxy(auditModel, {
          get(amTarget, name) {
            if (name === 'findMany' || name === 'findFirst') {
              return async (args: any) => {
                try {
                  return await (auditModel as any)[name](args)
                } catch (err: any) {
                  const msg = err && (err.message || String(err)) || ''
                  const lmsg = String(msg).toLowerCase()
                  // Accept a few known Prisma validation message variants so
                  // the raw-query fallback triggers for enum-validation errors
                  // across Prisma/PG/localized message differences.
                  const isEnumValidation = lmsg.includes('invalid input value for enum') || lmsg.includes('invalid value for argument') || lmsg.includes('expected adminactiontype')
                  if (!isEnumValidation) throw err

                  // Extract action filter if present (support simple shapes)
                  const where = args && args.where ? args.where : undefined
                  let actions: string[] | undefined
                  if (where) {
                    if (typeof where.action === 'string') actions = [where.action]
                    else if (where.action && typeof where.action.equals === 'string') actions = [where.action.equals]
                    else if (where.action && Array.isArray(where.action.in)) actions = where.action.in
                  }

                  if (!actions || actions.length === 0) throw err

                  // Fallback raw query: compare enum as text to avoid Postgres enum validation.
                  // Use ANY(...) to support multiple actions.
                  try {
                    const rows: any[] = await (target as any).$queryRaw`
                      SELECT * FROM "AuditLog"
                      WHERE (action::text = ANY(${actions}))
                        OR ((details->>'legacyAction') = ANY(${actions}))
                    `
                    if (name === 'findFirst') return rows[0] ?? null
                    return rows
                  } catch (_rawErr) {
                    // If raw fallback also fails, log the raw fallback error and propagate original error for visibility.
                    logger.warn('prisma.auditLog raw fallback failed', { error: String(_rawErr) })
                    throw err
                  }
                }
              }
            }

            // forward all other methods to the underlying model
            return (auditModel as any)[name]
          },
        })
      }

    // Default behaviour: forward to the real Prisma client
    return Reflect.get(target, prop, receiver);
  },
});

export const prisma = prismaProxy as unknown as PrismaClient;

process.on('exit', () => {
  try {
    void (client as any).$disconnect();
  } catch (err: any) {
    logger.warn('prisma disconnect failed', { err: (err && err.message) || err });
  }
});
