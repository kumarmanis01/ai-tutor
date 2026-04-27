import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatErrorForResponse } from '@/lib/errorResponse';

export async function POST(req: Request) {
  try {
    const adminSecretHeader = req.headers.get('x-admin-secret') || '';
    const adminSecretEnv = process.env.ADMIN_PURGE_SECRET || '';

    const hasSecret = adminSecretEnv && adminSecretHeader === adminSecretEnv;

    if (!hasSecret) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const sessions = await prisma.session.deleteMany({});
    const accounts = await prisma.account.deleteMany({});

    return NextResponse.json({ ok: true, deleted: { sessions: sessions.count, accounts: accounts.count } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: formatErrorForResponse(e) }, { status: 500 });
  }
}
