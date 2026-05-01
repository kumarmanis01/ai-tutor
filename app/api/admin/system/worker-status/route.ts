/**
 * FILE OBJECTIVE:
 * - Report recent worker heartbeat status for admin surfaces while enforcing shared admin authorization.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/admin/system/worker-status/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-05-01T00:00:00Z | copilot | switch auth to shared admin guard and return 403 for unauthorized requests
 */

import { NextResponse } from 'next/server';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await requireActiveAdmin();
  if (!guard.ok) {
    return NextResponse.json(
      { alive: false, error: { name: 'Error', message: 'Forbidden' } },
      { status: 403 }
    );
  }

  // Task worker registers with type='content-hydration' (the BullMQ queue name).
  // Detect liveness by heartbeat freshness (< 60s), not by type string.
  const cutoff = new Date(Date.now() - 60_000);
  const worker = await prisma.workerLifecycle
    .findFirst({
      where: {
        lastHeartbeatAt: { gte: cutoff },
        NOT: [{ type: { contains: 'web' } }, { type: { contains: 'scheduler' } }],
      },
      orderBy: { lastHeartbeatAt: 'desc' },
      select: { type: true, lastHeartbeatAt: true },
    })
    .catch(() => null);

  return NextResponse.json({
    alive: worker !== null,
    type: worker?.type ?? null,
    lastHeartbeatAt: worker?.lastHeartbeatAt?.toISOString() ?? null,
  });
}
