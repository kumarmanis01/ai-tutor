import { prisma } from '@/lib/prisma'
import { ConsentScope, AdminActionType, AccountStatus } from '@prisma/client'

export { ConsentScope }

/**
 * Returns true if a non-withdrawn Consent row exists for user + scope.
 * Never throws -- returns false on any error.
 */
export async function hasConsented(userId: string, scope: ConsentScope): Promise<boolean> {
  try {
    const row = await prisma.consent.findFirst({
      where: { userId, scope, withdrawnAt: null },
      select: { id: true },
    })
    return row !== null
  } catch {
    return false
  }
}

/**
 * Creates Consent rows for each scope (idempotent -- upserts by userId+scope).
 * Re-activates a previously withdrawn consent by clearing withdrawnAt.
 */
export async function grantConsent(
  userId: string,
  scopes: ConsentScope[],
  meta: { ipAddress?: string; userAgent?: string; version?: string } = {},
): Promise<void> {
  const version = meta.version ?? '1.0'
  await Promise.all(
    scopes.map((scope) =>
      prisma.consent.upsert({
        where: {
          // Prisma requires a unique constraint for upsert -- we use findFirst+create pattern
          // since @@index is not @@unique. Use a composite approach:
          id: `${userId}:${scope}`, // deterministic id for idempotency
        },
        update: {
          givenAt: new Date(),
          withdrawnAt: null,
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
          version,
        },
        create: {
          id: `${userId}:${scope}`,
          userId,
          scope,
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
          version,
        },
      }),
    ),
  )
}

/**
 * Sets withdrawnAt = now() on the active consent row for user + scope.
 * No-op if no active consent exists.
 */
export async function withdrawConsent(
  userId: string,
  scope: ConsentScope,
  meta: { ipAddress?: string; userAgent?: string } = {},
): Promise<void> {
  const now = new Date()

  // Mark consent withdrawn (idempotent)
  await prisma.consent.updateMany({
    where: { userId, scope, withdrawnAt: null },
    data: { withdrawnAt: now },
  })

  // If data-processing consent is withdrawn, initiate deletion workflow
  if (scope === ConsentScope.DATA_PROCESSING) {
    // If a deletion request already exists, don't create a duplicate.
    const existing = await prisma.deletionRequest.findUnique({ where: { userId } })

    if (!existing) {
      // Create request, deactivate account, and audit in a single transaction
      await prisma.$transaction([
        prisma.deletionRequest.create({ data: { userId } }),
        prisma.user.update({ where: { id: userId }, data: { accountStatus: AccountStatus.deletion_pending } }),
        prisma.auditLog.create({
          data: {
            targetEntity: 'User',
            targetId: userId,
            action: AdminActionType.ERASURE_REQUEST,
            ipAddress: meta.ipAddress ?? null,
            details: { scope, initiatedBy: 'consent-withdrawal' },
          },
        }),
      ])
    } else {
      // Ensure account is in deletion_pending state and audit the withdrawal
      await prisma.user.update({ where: { id: userId }, data: { accountStatus: AccountStatus.deletion_pending } })
      await prisma.auditLog.create({
        data: {
          targetEntity: 'User',
          targetId: userId,
          action: AdminActionType.ERASURE_REQUEST,
          ipAddress: meta.ipAddress ?? null,
          details: { scope, note: 'Deletion request already exists' },
        },
      })
    }
  } else {
    // Other consent withdrawals: record an audit entry for traceability
    await prisma.auditLog.create({
      data: {
        targetEntity: 'Consent',
        targetId: `${userId}:${scope}`,
        action: null,
        ipAddress: meta.ipAddress ?? null,
        details: { scope, withdrawnAt: now.toISOString(), initiatedBy: 'consent-withdrawal' },
      },
    })
  }
}
