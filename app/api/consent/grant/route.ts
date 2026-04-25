import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { grantConsent, ConsentScope } from '@/lib/consent/check';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_SCOPES = new Set<string>(Object.values(ConsentScope));

/**
 * POST /api/consent/grant
 * Body: { scopes: ConsentScope[] }
 * Returns: { granted: true, scopes }
 */
export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'ConsentGrantAPI', methodName: 'POST' }, start);
    return res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    logger.logAPI(req, res, { className: 'ConsentGrantAPI', methodName: 'POST' }, start);
    return res;
  }

  const rawScopes = (body as any)?.scopes;
  if (!Array.isArray(rawScopes) || rawScopes.length === 0) {
    const res = NextResponse.json({ error: 'scopes array required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'ConsentGrantAPI', methodName: 'POST' }, start);
    return res;
  }

  const scopes = rawScopes.filter(
    (s): s is ConsentScope => typeof s === 'string' && VALID_SCOPES.has(s)
  );
  if (scopes.length === 0) {
    const res = NextResponse.json({ error: 'No valid scopes provided' }, { status: 400 });
    logger.logAPI(req, res, { className: 'ConsentGrantAPI', methodName: 'POST' }, start);
    return res;
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? (req as any).ip ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  await grantConsent(userId, scopes, { ipAddress: ip, userAgent });

  const res = NextResponse.json({ granted: true, scopes }, { status: 200 });
  logger.logAPI(req, res, { className: 'ConsentGrantAPI', methodName: 'POST' }, start);
  return res;
}
