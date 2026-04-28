/**
 * FILE OBJECTIVE:
 * - A1.1: Content Moderation Dashboard server entry point.
 *   Fetches initial page of moderation queue and renders the client component.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/moderation/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A1.1 moderation dashboard page
 */

import React from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { ModerationDashboardClient } from './ModerationDashboardClient';

export const dynamic = 'force-dynamic';

export default async function ModerationPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect('/auth/signin');
  if (session.user.role !== 'admin' && session.user.role !== 'moderator') {
    redirect('/admin');
  }

  // Server-side fetch of first page for SSR (avoids extra client round-trip)
  let initialItems: unknown[] = [];
  let initialTotal = 0;
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

    initialItems = rawItems.map((item) => {
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
    initialTotal = total;
  } catch (error: unknown) {
    // Non-fatal -- client will fetch on mount; log so SSR failures are diagnosable
    logger.error('ModerationPage SSR prefetch failed', {
      route: 'app/admin/moderation/page.tsx',
      operation: 'ModerationPage.initialDataFetch',
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
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
      <ModerationDashboardClient
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        initialItems={initialItems as any}
        initialTotal={initialTotal}
      />
    </div>
  );
}
