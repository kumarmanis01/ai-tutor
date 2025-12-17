import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logApiUsage } from '@/utils/logApiUsage';
import { getServerSessionForHandlers } from '@/lib/session';

// @ts-expect-error Ignore type checking for params in this handler
export async function PATCH(req, { params }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const data = await req.json();
  const user = await prisma.user.update({
    where: { id: params.id },
    data,
  });
  logApiUsage(`/api/admin/users/${params.id}`, 'PATCH');
  return NextResponse.json(user);
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSessionForHandlers();
  if (!session?.user?.id || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    await prisma.$transaction([
      prisma.user.update({ where: { id }, data: { status: 'suspended' } }),
      prisma.auditLog.create({ data: { userId: session.user.id, action: 'soft_delete_user', details: { userId: id }, createdAt: new Date() } })
    ]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}
