import React from 'react';
import { prisma } from '@/lib/prisma';
import { AdminTopbar } from '../../../components/admin/AdminTopbar';
import { ContentGapsTable, type ContentGapRow } from './ContentGapsTable';

export default async function ContentGapsPage() {
  const [gaps, statDetected, statPending, statResolved] = await Promise.all([
    prisma.contentGap.findMany({
      orderBy: [{ status: 'asc' }, { detectedAt: 'desc' }],
      take: 500,
      select: {
        id: true,
        boardSlug: true,
        grade: true,
        difficulty: true,
        currentCount: true,
        targetCount: true,
        status: true,
        detectedAt: true,
        hydrationJobId: true,
        topic: { select: { name: true } },
        subject: {
          select: {
            name: true,
            class: { select: { grade: true, board: { select: { slug: true } } } },
          },
        },
      },
    }).catch(() => []),

    prisma.contentGap.count({ where: { status: 'detected' } }).catch(() => 0),
    prisma.contentGap.count({ where: { status: 'hydration_pending' } }).catch(() => 0),
    prisma.contentGap.count({ where: { status: 'resolved' } }).catch(() => 0),
  ]);

  const rows: ContentGapRow[] = gaps.map((g) => ({
    id: g.id,
    subjectName: g.subject.name,
    boardSlug: g.subject.class.board.slug,
    grade: g.subject.class.grade,
    topicName: g.topic.name,
    difficulty: g.difficulty,
    currentCount: g.currentCount,
    targetCount: g.targetCount,
    status: g.status,
    detectedAt: g.detectedAt.toISOString(),
    hydrationJobId: g.hydrationJobId ?? null,
  }));

  return (
    <>
      <AdminTopbar title="Content Gaps" runningJobs={statPending} />

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Detected" value={statDetected} variant={statDetected > 0 ? 'red' : 'default'} />
          <StatCard label="Hydration pending" value={statPending} variant="amber" />
          <StatCard label="Resolved" value={statResolved} variant="green" />
          <StatCard label="Total tracked" value={gaps.length} variant="default" />
        </div>

        <ContentGapsTable rows={rows} />
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: 'red' | 'amber' | 'green' | 'default';
}) {
  const colors = {
    red: 'text-[#791F1F]',
    amber: 'text-[#633806]',
    green: 'text-[#27500A]',
    default: 'text-gray-900 dark:text-white',
  };
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${colors[variant]}`}>{value}</p>
    </div>
  );
}
