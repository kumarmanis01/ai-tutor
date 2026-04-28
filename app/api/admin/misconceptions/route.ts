/**
 * FILE OBJECTIVE:
 * - Admin API: list and create misconceptions used by platform moderation.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/misconceptions/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-13T00:00:00Z | copilot | fix: remove duplicate import and balance try/catch
 */

import { getServerSessionForHandlers } from '@/lib/session';
import { requireAdmin } from '@/auth/adminGuard';
import { prisma as getPrismaClient } from '@/lib/prisma';
import { MisconceptionCreateSchema } from '@/lib/validators/misconception';
import { logger } from '@/lib/logger';

type _CreateResult = { rows: any[]; total: number };

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  try {
    requireAdmin(session);
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
  const url = new URL(req.url);
  const subjectId = url.searchParams.get('subjectId') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(5, parseInt(url.searchParams.get('pageSize') || '20', 10) || 20)
  );

  const db = getPrismaClient;

  const where: any = {};
  if (subjectId) where.subjectId = subjectId;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
      { correction: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.misconception.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.misconception.count({ where }),
  ]);

  return new Response(JSON.stringify({ rows, total }), { status: 200 });
}

export async function POST(req: Request) {
  const session = await getServerSessionForHandlers();
  try {
    requireAdmin(session);
  } catch {
    return new Response('Forbidden', { status: 403 });
  }
  const raw = await req.json();
  const parsed = MisconceptionCreateSchema.safeParse(raw);
  if (!parsed.success)
    return new Response(
      JSON.stringify({ error: 'invalid_payload', details: parsed.error.format() }),
      { status: 400 }
    );
  const body = parsed.data;

  // Ensure subject and concept exist
  const db = getPrismaClient;
  const s = await db.subjectDef.findUnique({ where: { id: body.subjectId } });
  if (!s) return new Response(JSON.stringify({ error: 'invalid_subject' }), { status: 400 });
  const c = await db.concept.findUnique({ where: { id: body.conceptId } });
  if (!c) return new Response(JSON.stringify({ error: 'invalid_concept' }), { status: 400 });

  const created = await db.misconception.create({
    data: {
      id: `MIS-${Date.now()}`,
      name: body.name,
      description: body.description,
      correction: body.correction,
      triggerPatterns: body.triggerPatterns,
      prevalenceRate: body.prevalenceRate ?? 0,
      subjectId: body.subjectId,
      conceptId: body.conceptId,
    },
  });

  try {
    await db.auditLog.create({
      data: {
        adminId: session?.user?.id ?? null,
        targetEntity: 'Misconception',
        targetId: created.id,
        action: 'MISCONCEPTION_CREATE',
        previousValue: null,
        newValue: created as any,
      },
    });
  } catch (e) {
    logger.warn('audit failed', { error: String(e) });
  }

  return new Response(JSON.stringify(created), { status: 201 });
}
