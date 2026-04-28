import { NextResponse } from 'next/server';
import { getServerSessionForHandlers } from '@/lib/session';
import { withdrawConsent, ConsentScope } from '@/lib/consent/check';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const VALID_SCOPES = new Set<string>(Object.values(ConsentScope));

/**
 * POST /api/consent/withdraw
 * Body: { scope: ConsentScope }
 * Returns: { withdrawn: true }
 */
export async function POST(req: Request) {
  const start = Date.now();
  const session = await getServerSessionForHandlers();
  const userId = (session?.user as { id?: string })?.id;
  if (!userId) {
    const res = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    logger.logAPI(req, res, { className: 'ConsentWithdrawAPI', methodName: 'POST' }, start);
    return res;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const res = NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    logger.logAPI(req, res, { className: 'ConsentWithdrawAPI', methodName: 'POST' }, start);
    return res;
  }

  const scope = (body as any)?.scope;
  if (typeof scope !== 'string' || !VALID_SCOPES.has(scope)) {
    const res = NextResponse.json({ error: 'Valid scope required' }, { status: 400 });
    logger.logAPI(req, res, { className: 'ConsentWithdrawAPI', methodName: 'POST' }, start);
    return res;
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? (req as any).ip ?? undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;

  await withdrawConsent(userId, scope as ConsentScope, { ipAddress: ip, userAgent });

  const res = NextResponse.json({ withdrawn: true }, { status: 200 });
  logger.logAPI(req, res, { className: 'ConsentWithdrawAPI', methodName: 'POST' }, start);
  return res;
}
