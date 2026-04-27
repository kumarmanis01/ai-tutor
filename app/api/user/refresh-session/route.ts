import { logger } from '@/lib/logger';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const start = Date.now();
  let res: Response;
  try {
    const session = await getServerSessionForHandlers();
    if (!session || !session.user || !session.user.id) {
      res = NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      logger.logAPI(req, res, { className: 'UserRefreshSessionAPI', methodName: 'POST' }, start);
      return res;
    }

    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!dbUser) {
      res = NextResponse.json({ error: 'not_found' }, { status: 404 });
      logger.logAPI(req, res, { className: 'UserRefreshSessionAPI', methodName: 'POST' }, start);
      return res;
    }

    // Return minimal identity that mirrors the session's minimal shape.
    res = NextResponse.json({
      id: dbUser.id,
      name: dbUser.name ?? null,
      email: dbUser.email ?? null,
      image: dbUser.image ?? null,
      role: dbUser.role ?? null,
    });
    logger.logAPI(req, res, { className: 'UserRefreshSessionAPI', methodName: 'POST' }, start);
    return res;
  } catch (err) {
    logger.error('POST /api/user/refresh-session error', { className: 'api.user.refresh-session', methodName: 'POST', error: err });
    res = NextResponse.json({ error: formatErrorForResponse(err) }, { status: 500 });
    logger.logAPI(req, res, { className: 'UserRefreshSessionAPI', methodName: 'POST' }, start);
    return res;
  }
}
