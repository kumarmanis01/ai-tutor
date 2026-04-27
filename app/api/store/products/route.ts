import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

export async function GET(req: Request) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const url = new URL(req.url)
  const qTenant = url.searchParams.get('tenantId')

  const session = await getServerSessionForHandlers()
  const sessionTenant = session?.user?.tenantId ?? null

  // If tenant provided in query and session tenant exists but mismatches, reject
  if (qTenant && sessionTenant && String(qTenant) !== String(sessionTenant)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const tenantId = qTenant ?? sessionTenant
  const where: any = {}
  if (tenantId) where.tenantId = tenantId

  const rows = await db.product.findMany({ where, orderBy: { courseId: 'asc' } })
  return NextResponse.json(rows)
}

export default GET
