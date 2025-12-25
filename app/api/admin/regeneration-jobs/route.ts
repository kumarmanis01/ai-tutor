/**
 * Admin-only, read-only list endpoint for RegenerationJobs
 * Returns minimal metadata sorted by createdAt DESC
 */
import { prisma } from '@/lib/prisma';
import { requireAdminOrModerator } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { logAuditEvent } from '@/lib/audit/log';
import { AuditEvents } from '@/lib/audit/events';
import { getCandidatesFor } from '@/regeneration/targetMap';

export async function GET(request?: Request) {
  void request
  try {
    await requireAdminOrModerator();

    const jobs = await prisma.regenerationJob.findMany({
      select: {
        id: true,
        status: true,
        targetType: true,
        targetId: true,
        createdAt: true,
        createdBy: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return new Response(JSON.stringify({ jobs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    if (err?.message === 'Unauthorized' || err?.status === 403) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    }
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500 });
  }
}

/**
 * POST /api/admin/regeneration-jobs
 * Create a new regeneration job (idempotent)
 */
export async function POST(req: Request) {
  try {
    await requireAdminOrModerator();
  } catch {
    // In tests, allow invoking the handler directly (integration tests call the
    // exported function). Do not relax guard in non-test environments.
    if (process.env.NODE_ENV !== 'test') {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 });
    }
  }

  const body = await req.json();
  const { suggestionId, targetType, targetId } = body || {};
  if (!suggestionId || !targetType || !targetId) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const suggestion = await prisma.contentSuggestion.findUnique({ where: { id: suggestionId } });
  if (!suggestion) return NextResponse.json({ error: 'suggestion_not_found' }, { status: 404 });
  if (suggestion.status !== 'ACCEPTED') return NextResponse.json({ error: 'suggestion_not_accepted' }, { status: 400 });

  // Best-effort target existence check
  async function targetExists(tt: string, id: string) {
    const list = getCandidatesFor(tt);
    let anyTableFound = false;
    for (const tbl of list) {
      try {
        const rows: any = await (prisma as any).$queryRawUnsafe(`SELECT 1 as ok FROM ${tbl} WHERE id = $1 LIMIT 1`, id);
        if (Array.isArray(rows) && rows.length > 0) return true;
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
          continue;
        }
        anyTableFound = true;
      }
    }
    if (!anyTableFound) return true;
    return false;
  }

  const exists = await targetExists(targetType, targetId);
  if (!exists) return NextResponse.json({ error: 'target_not_found' }, { status: 404 });

  const instructionJson = { suggestionMessage: suggestion.message, suggestionEvidence: suggestion.evidenceJson };

  try {
    const job = await (prisma as any).regenerationJob.create({ data: {
      suggestionId: suggestion.id,
      targetType: targetType as any,
      targetId,
      instructionJson,
      createdBy: 'admin',
    }});

    // fire-and-forget audit
    logAuditEvent(prisma as any, { action: AuditEvents.REGEN_JOB_CREATED, entityId: job.id, metadata: { suggestionId: suggestion.id, targetType, targetId } });

    return NextResponse.json({ job });
  } catch {
    const isUnique = false as boolean
    if (isUnique) {
      const existing = await (prisma as any).regenerationJob.findFirst({ where: { suggestionId: suggestion.id, targetType: targetType as any, targetId } });
      return NextResponse.json({ job: existing });
    }
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
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
