import { NextResponse } from 'next/server'
import { getServerSessionForHandlers } from '@/lib/session'

export async function POST(req: Request) {
  const db = (global as any).__TEST_PRISMA__ ?? (await import('@/lib/prisma')).prisma
  const body = await req.json()
  const { productId } = body || {}

  const session = await getServerSessionForHandlers()
  const userId = session?.user?.id
  if (!userId || !productId) return NextResponse.json({ error: 'Missing fields or unauthorized' }, { status: 400 })

  const prod = await db.product.findUnique({ where: { id: productId } })
  if (!prod) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  // Create purchase record
  const created = await db.purchase.create({ data: { userId, productId } })
  return NextResponse.json({ ok: true, purchase: created }, { status: 201 })
}

export default POST
