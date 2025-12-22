import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const url = new URL(req.url)
  const tenantId = url.searchParams.get('tenantId')
  const where: any = {}
  if (tenantId) where.tenantId = tenantId

  const rows = await db.product.findMany({ where, orderBy: { courseId: 'asc' } })
  return NextResponse.json(rows)
}

export default GET
