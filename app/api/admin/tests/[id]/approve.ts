import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSessionForHandlers();
  const adminId = session?.user?.id ?? 'SYSTEM_ADMIN';

  const test = await prisma.generatedTest.findUnique({ where: { id: params.id } });
  if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.generatedTest.update({ where: { id: params.id }, data: { status: ApprovalStatus.Approved } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'approve_test', details: { testId: params.id, fromStatus: test.status }, createdAt: new Date() } })
  ]);

  return NextResponse.json({ approved: true });
}
