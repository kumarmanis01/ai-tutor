import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const invoices = await prisma.invoice.findMany({
    where: { userId },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      currency: true,
      fileUrl: true,
      createdAt: true,
      hsnCode: true,
      gstin: true,
      taxBreakdown: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invoices }, { status: 200 });
}
