import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'
import { logAuditEvent } from '@/lib/audit/log'

export async function POST(req: Request) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const body = await req.json()
  const { productId } = body || {}

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  const sessionTenant = session?.user?.tenantId ?? null
  if (!userId || !productId) return NextResponse.json({ error: 'Missing fields or unauthorized' }, { status: 400 })

  const prod = await db.product.findUnique({ where: { id: productId } })
  if (!prod) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Enforce session tenant matches product.tenantId
  if (prod.tenantId) {
    if (!sessionTenant || String(prod.tenantId) !== String(sessionTenant)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // Create purchase record
  const created = await db.purchase.create({ data: { userId, productId } })

  // Audit the purchase (non-blocking)
  logAuditEvent(db, { actorId: userId, action: 'purchase_create', entityType: 'PRODUCT', entityId: productId, metadata: { purchaseId: created.id, productId, tenantId: prod?.tenantId ?? null } })

  return NextResponse.json({ ok: true, purchase: created }, { status: 201 })
}

export default POST
