/**
 * FILE OBJECTIVE:
 * - API endpoint returning recent LTV/CAC snapshots.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/metrics_ltv_cac_history.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSessionForHandlers } from '@/lib/session'

export async function GET(req: Request) {
  const session = await getServerSessionForHandlers();
  const role = (session?.user as any)?.role ?? null;
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') ?? '30')
  try {
    const rows = await prisma.ltvSnapshot.findMany({ orderBy: { snapshotAt: 'desc' }, take: Math.min(200, Math.max(1, limit)) })
    return NextResponse.json({ ok: true, rows })
  } catch (err) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
