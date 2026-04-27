import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSessionForHandlers } from '@/lib/session';
import { logApiUsage } from '@/utils/logApiUsage';
import { logAuditEvent } from '@/lib/audit/log';

/**
 * Admin coupons endpoint
 * GET: list coupons
 * POST: create coupon
 * DELETE: bulk deactivate by code (body: { codes: string[] })
 */
export async function GET() {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const rows = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  logApiUsage('/api/admin/coupons', 'GET');
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const { code, description, type, amount, scope, studentId, batchId, maxUses, maxUsesPerUser, validFrom, validUntil } = body;
  if (!code || !type || typeof amount !== 'number') return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });

  const created = await prisma.coupon.create({ data: { code, description: description ?? null, type, amount: Math.floor(amount), scope: scope ?? 'GLOBAL', studentId: studentId ?? null, batchId: batchId ?? null, maxUses: maxUses ?? null, maxUsesPerUser: maxUsesPerUser ?? null, validFrom: validFrom ? new Date(validFrom) : null, validUntil: validUntil ? new Date(validUntil) : null, createdBy: session.user.id } });

  try { logAuditEvent(prisma as any, { adminId: session.user.id, targetEntity: 'Coupon', targetId: created.id, action: null, details: { legacyAction: 'COUPON_CREATED', code } }) } catch {}

  logApiUsage('/api/admin/coupons', 'POST');
  return NextResponse.json(created);
}

export async function DELETE(req: Request) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json();
  const codes = Array.isArray(body.codes) ? body.codes : [];
  if (codes.length === 0) return NextResponse.json({ error: 'codes_required' }, { status: 400 });

  const updated = await prisma.coupon.updateMany({ where: { code: { in: codes } }, data: { active: false } });
  try { logAuditEvent(prisma as any, { adminId: session.user.id, targetEntity: 'Coupon', targetId: 'bulk', action: null, details: { legacyAction: 'COUPON_DEACTIVATED', codes } }) } catch {}
  logApiUsage('/api/admin/coupons', 'DELETE');
  return NextResponse.json({ ok: true, count: updated.count });
}
