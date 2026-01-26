import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Ensure this path is correct
import { logApiUsage } from '@/utils/logApiUsage';

export async function POST(request: NextRequest) {
  try {
    logApiUsage('/api/audit', 'POST');
    const auditData = await request.json();

    // Log the audit data using central logger when available
    logger.add(`Audit Trail: ${JSON.stringify(auditData)}`, { className: 'audit', methodName: 'POST' });

    return NextResponse.json({ message: 'Audit trail logged successfully' }, { status: 200 });
  } catch (error) {
    logger.error('Failed to log audit trail', { className: 'api.audit', methodName: 'POST', error });
    return NextResponse.json({ message: 'Failed to log audit trail', error: formatErrorForResponse(error) }, { status: 500 });
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
    logger.error('Failed to fetch audit logs', { className: 'api.audit', methodName: 'GET', error });
    return NextResponse.json({ message: 'Failed to fetch audit logs', error: formatErrorForResponse(error) }, { status: 500 });
  }
}
