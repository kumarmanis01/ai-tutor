import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';
import { normalizeLanguage } from '@/lib/normalize';
import { SessionUser } from '@/lib/types';

export async function GET() {
  try {
    const session = await getServerSessionForHandlers();
    if (!session) return NextResponse.json({ language: null });
    const user = session.user as SessionUser;
    if (!user?.id) return NextResponse.json({ language: null });
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    return NextResponse.json({ language: dbUser?.language ?? null });
  } catch (e) {
    logger.error('GET /api/user/language error', { className: 'api.user.language', methodName: 'GET', error: e });
    return NextResponse.json({ language: null }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSessionForHandlers();
    if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = session.user as SessionUser;
    if (!user?.id) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const body = await req.json();
    const { language } = body as { language?: string };
    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'invalid_language' }, { status: 400 });
    }

    const langEnum = normalizeLanguage(language);
    await prisma.user.update({ where: { id: user.id }, data: { language: langEnum } });
    return NextResponse.json({ ok: true, language: langEnum });
  } catch (e) {
    logger.error('POST /api/user/language error', { className: 'api.user.language', methodName: 'POST', error: e });
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
