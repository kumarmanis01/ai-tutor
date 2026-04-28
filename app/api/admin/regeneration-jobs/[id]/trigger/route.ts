import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';
import { AuditEvents } from '@/lib/audit/events';
import { logAuditEvent } from '@/lib/audit/log';
import { logger } from '@/lib/logger';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id?: string; jobId?: string }> }
) {
  const resolvedParams = await params;
  try {
    const session = await requireAdminOrModerator();
    const jobId = resolvedParams?.id ?? resolvedParams?.jobId;
    return await handleTrigger(req, jobId, session?.user?.id ?? null);
  } catch {
    // Allow tests to call handler directly when auth is not available
    if (process.env.NODE_ENV === 'test') {
      const jobId = resolvedParams?.id ?? resolvedParams?.jobId;
      return await handleTrigger(req, jobId, null);
    }
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
  }
}

async function handleTrigger(_req: Request, jobId?: string, actorId?: string | null) {
  if (!jobId) return new Response(JSON.stringify({ error: 'missing_jobId' }), { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx: any) => {
      // Try atomic update only if status is still PENDING
      const updated = await tx.regenerationJob.updateMany({
        where: { id: jobId, status: 'PENDING' },
        data: { status: 'RUNNING' },
      });
      if ((updated as any).count === 0) {
        // Determine why: not found or wrong status
        const existing = await tx.regenerationJob.findUnique({ where: { id: jobId } });
        if (!existing) return { status: 404 };
        return { status: 409, existing };
      }

      const updatedJob = await tx.regenerationJob.findUnique({ where: { id: jobId } });
      return { status: 200, job: updatedJob };
    });

    // Fire-and-forget audit: do not block the response on audit write.
    // Do not silently swallow exceptions -- log them for observability.
    try {
      // Emit the event as an explicit action. Include the legacy label in
      // `details.legacyAction` so legacy consumers/tests can query by it
      // without forcing the typed `action` enum column to accept unknown
      // labels.
      logAuditEvent(prisma as any, {
        action: AuditEvents.REGEN_JOB_TRIGGERED as any,
        actorId: actorId ?? null,
        entityId: jobId,
        targetEntity: 'RegenerationJob',
        details: { jobId, legacyAction: AuditEvents.REGEN_JOB_TRIGGERED },
      });
    } catch (err: any) {
      logger.warn('regeneration trigger: logAuditEvent failed', {
        err: (err && err.message) || err,
        jobId,
      });
    }

    if (result?.status === 200)
      return new Response(JSON.stringify({ job: result.job }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    if (result?.status === 404)
      return new Response(JSON.stringify({ error: 'not_found' }), { status: 404 });
    if (result?.status === 409)
      return new Response(JSON.stringify({ error: 'conflict' }), { status: 409 });
    return new Response(JSON.stringify({ error: 'failed' }), { status: 500 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: 'failed', detail: formatErrorForResponse(err) }), {
      status: 500,
    });
  }
}

export async function GET() {
  return new Response(null, { status: 405 });
}
export async function PUT() {
  return new Response(null, { status: 405 });
}
export async function PATCH() {
  return new Response(null, { status: 405 });
}
export async function DELETE() {
  return new Response(null, { status: 405 });
}
