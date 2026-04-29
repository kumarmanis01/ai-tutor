/**
 * FILE OBJECTIVE:
 * - A1.1: Content Moderation Dashboard server entry point.
 *   Fetches initial page of moderation queue and renders the client component.
 *   Provides a graceful fallback when the `Content` table is missing (pre-migration).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/moderation/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-29T15:40:00Z | copilot | add resilient data fetch with missing-table handling and exported helper for unit tests
 */

import React from 'react';
import { redirect } from 'next/navigation';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { logger } from '@/lib/logger';
import { ModerationDashboardClient } from './ModerationDashboardClient';

export const dynamic = 'force-dynamic';

function isMissingTableError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = (err as any)?.message ?? String(err);
  if (typeof msg !== 'string') return false;
  const lowered = msg.toLowerCase();
  if (lowered.includes('does not exist') && (lowered.includes('relation') || lowered.includes('table') || lowered.includes('public.'))) return true;
  return false;
}

export async function fetchModerationInitialData(adminUserId: string) {
  const operation = 'ModerationPage.initialDataFetch';
  try {
    const { prisma } = await import('@/lib/db');
    const [rawItems, total] = await prisma.$transaction([
      prisma.content.findMany({
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          topic: true,
          subject: true,
          grade: true,
          board: true,
          language: true,
          type: true,
          status: true,
          version: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { flags: true } },
          generationJobs: {
            select: { id: true, subscriberIds: true, status: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      }),
      prisma.content.count(),
    ]);

    const initialItems = rawItems.map((item) => {
      const job = item.generationJobs[0];
      return {
        id: item.id,
        topic: item.topic,
        subject: item.subject,
        grade: item.grade,
        board: item.board,
        language: item.language,
        type: item.type,
        status: item.status,
        version: item.version,
        requestCount: job ? job.subscriberIds.length + 1 : 0,
        flagCount: item._count.flags,
        jobStatus: job?.status ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      };
    });

    return { items: initialItems, total, migrated: true };
  } catch (err) {
    logger.error('[ERROR] ModerationPage SSR prefetch failed', {
      route: 'app/admin/moderation/page.tsx',
      operation,
      adminUserId,
      error: err instanceof Error ? err.message : String(err),
    });

    if (isMissingTableError(err)) {
      return { items: [], total: 0, migrated: false };
    }

    throw err;
  }
}

export default async function ModerationPage() {
  const guard = await requireActiveAdmin();
  if (!guard.ok) redirect('/admin/login');

  let items: unknown[] = [];
  let total = 0;
  let migrated = true;

  try {
    const res = await fetchModerationInitialData(guard.adminUserId);
    items = res.items;
    total = res.total;
    migrated = res.migrated;
  } catch (err) {
    // Unexpected errors should surface to monitoring; we've already logged in helper.
    // Re-throw so Next.js / Sentry capture it rather than silently continuing.
    throw err;
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content Moderation</h1>
        <p className="mt-1 text-sm text-gray-600">
          Review AI-generated and curated content. Approve, reject, or flag items for revision.
          Auto-refreshes every 30s.
        </p>
      </div>

      {!migrated && (
        <div role="status" className="mb-4 p-3 rounded bg-yellow-50 text-yellow-800">
          Moderation database table not found. Please run migrations on the database. Showing empty results.
        </div>
      )}

      <ModerationDashboardClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialItems={items as any}
        initialTotal={total}
      />
    </div>
  );
}
