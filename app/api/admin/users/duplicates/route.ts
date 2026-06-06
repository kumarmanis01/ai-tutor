/**
 * GET /api/admin/users/duplicates
 * F-ADM-020 AC-05: Find duplicate student accounts sharing the same phone number.
 *
 * Returns accounts where phone is non-null and appears more than once.
 * In normal operation this returns nothing (phone has a unique constraint),
 * but acts as a safety net for data-migration or constraint-bypass scenarios.
 */
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface DuplicateGroup {
  phone: string
  userIds: string[]
  count: number
}

interface DuplicateRow {
  phone: string
  user_ids: string[]
  count: bigint
}

export async function GET(_req: Request) {
  const session = await getServerSessionForHandlers()
  if (!session?.user?.id || (session.user as any).role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rows = await prisma.$queryRaw<DuplicateRow[]>`
    SELECT
      phone,
      ARRAY_AGG(id ORDER BY "createdAt" ASC) AS user_ids,
      COUNT(*)::bigint                        AS count
    FROM "User"
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
    ORDER BY count DESC
    LIMIT 100
  `

  // Mask phone numbers so admin views never expose full PII. Admins
  // identify duplicate accounts via userIds; the last 4 digits are
  // sufficient to disambiguate in the UI.
  const maskPhone = (p: string): string => {
    if (!p) return ''
    const digits = p.replace(/\D/g, '')
    if (digits.length <= 4) return '***'
    return `***-***-${digits.slice(-4)}`
  }

  const duplicates: DuplicateGroup[] = rows.map((r) => ({
    phone: maskPhone(r.phone),
    userIds: r.user_ids,
    count: Number(r.count),
  }))

  return NextResponse.json({
    duplicates,
    total: duplicates.length,
  })
}
