import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getServerSessionForHandlers } from '@/lib/session';
import { ApprovalStatus } from '@/lib/ai-engine/types';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { reason } = await req.json();
  if (reason) logger.add(`Test rejected for reason: ${reason}`);

  const session = await getServerSessionForHandlers();
  const adminId = session?.user?.id ?? 'SYSTEM_ADMIN';

  const test = await prisma.generatedTest.findUnique({ where: { id: params.id } });
  if (!test) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.$transaction([
    prisma.generatedTest.update({ where: { id: params.id }, data: { status: ApprovalStatus.Rejected } }),
    prisma.auditLog.create({ data: { userId: adminId, action: 'reject_test', details: { testId: params.id, reason, fromStatus: test.status }, createdAt: new Date() } })
  ]);

  return NextResponse.json({ rejected: true });
}
