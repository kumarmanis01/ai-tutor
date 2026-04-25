import { getServerSessionForHandlers } from '@/lib/session';
import { requireAdmin } from '@/auth/adminGuard';
import { formatErrorForResponse } from '@/lib/errorResponse';
import { logger } from '@/lib/logger';
import { setSafetyEventResolved } from '@/services/admin/safetyEvents';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const start = Date.now();
  try {
    const session = await getServerSessionForHandlers();
    try {
      requireAdmin(session);
    } catch {
      const res = new Response('Forbidden', { status: 403 });
      logger.logAPI(
        req,
        res,
        { className: 'AdminSafetyEventPatchAPI', methodName: 'PATCH' },
        start
      );
      return res;
    }

    const bodyRaw = await req.json().catch(() => null);
    const schema = z.object({ resolved: z.boolean() });
    const body = schema.parse(bodyRaw);

    const { id: rawId } = await params;
    const id = String(rawId || '').trim();
    if (!id) {
      const res = new Response(JSON.stringify({ error: 'Missing id', code: 'BAD_REQUEST' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
      logger.logAPI(
        req,
        res,
        { className: 'AdminSafetyEventPatchAPI', methodName: 'PATCH' },
        start
      );
      return res;
    }

    await setSafetyEventResolved({ id, resolved: body.resolved });

    const res = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    logger.logAPI(req, res, { className: 'AdminSafetyEventPatchAPI', methodName: 'PATCH' }, start);
    return res;
  } catch (err) {
    const res = new Response(
      JSON.stringify({ error: formatErrorForResponse(err), code: 'INTERNAL_ERROR' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
    logger.logAPI(req, res, { className: 'AdminSafetyEventPatchAPI', methodName: 'PATCH' }, start);
    return res;
  }
}
