import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db'; // Ensure this path is correct
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(request: NextRequest) {
  try {
    logApiUsage('/api/audit', 'POST');
    const auditData = await request.json();

    // Log the audit data to the console (or save it to a database/logging service)
    console.log('Audit Trail:', auditData);

    return NextResponse.json({ message: 'Audit trail logged successfully' }, { status: 200 });
  } catch (error) {
    console.error('Failed to log audit trail:', error);
    return NextResponse.json({ message: 'Failed to log audit trail' }, { status: 500 });
  }
}

export async function GET() {
  try {
    logApiUsage('/api/audit', 'GET');
    if (!prisma) {
      throw new Error('Prisma client is not initialized');
    }

    const auditLogs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(auditLogs, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch audit logs:', error);
    return NextResponse.json({ message: 'Failed to fetch audit logs' }, { status: 500 });
  }
}
