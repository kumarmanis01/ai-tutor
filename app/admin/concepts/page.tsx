/**
 * FILE OBJECTIVE:
 * - Admin page for AI-powered TopicConcept seeding. Lets admins generate and store
 *   concepts for any board/grade/subject/chapter combination on demand, without
 *   touching the existing content-engine hydration pipeline.
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | initial implementation for admin concept seeder
 */

import React from 'react';
import { prisma } from '@/lib/prisma';
import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { ConceptSeederClient } from './ConceptSeederClient';

export default async function ConceptSeederPage() {
  const rows = await prisma.topicConcept.groupBy({
    by: ['board', 'grade', 'subject', 'topicSlug'],
    _count: { id: true },
    orderBy: [{ board: 'asc' }, { grade: 'asc' }, { subject: 'asc' }, { topicSlug: 'asc' }],
  });

  const coverage = rows.map((r: typeof rows[number]) => ({
    board: r.board,
    grade: r.grade,
    subject: r.subject,
    topicSlug: r.topicSlug,
    count: r._count.id,
  }));

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <AdminTopbar title="Concept Seeder" />
      <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-5xl mx-auto space-y-2">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Generate key concepts for any chapter using AI. Each run saves directly to the{' '}
            <span className="font-mono">TopicConcept</span> table (duplicates skipped). These
            concepts power the demand-pull practice panel in student sessions.
          </p>
          <ConceptSeederClient initialCoverage={coverage} />
        </div>
      </main>
    </div>
  );
}
