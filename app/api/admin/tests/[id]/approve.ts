import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSessionForHandlers();
  // Resolve canonical DB user id for audit safety; fall back to null
  let adminId: string | null = null;
  try {
    if (session?.user?.id) {
      const byId = await prisma.user.findUnique({ where: { id: session.user.id } });
      if (byId) adminId = byId.id;
    }
    if (!adminId && session?.user?.email) {
      const byEmail = await prisma.user.findUnique({ where: { email: session.user.email } });
      if (byEmail) adminId = byEmail.id;
    }
  } catch {
    adminId = null;
  }

  const test = await prisma.generatedTest.findUnique({ where: { id: params.id } });
  if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.generatedTest.update({ where: { id: params.id }, data: { status: ApprovalStatus.Approved } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'approve_test', details: { testId: params.id, fromStatus: test.status }, createdAt: new Date() } })
  ]);

  return NextResponse.json({ approved: true });
}
