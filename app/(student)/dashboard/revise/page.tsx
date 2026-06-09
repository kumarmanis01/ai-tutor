/**
 * FILE OBJECTIVE:
 * - Revise tab: Server Component that renders a list of DEVELOPING topics
 *   for the authenticated student, sorted by lastStudiedAt ASC (idle-first).
 *
 * EDIT LOG:
 * - 2026-06-09T00:00:00Z | claude | S2-2 PART D: initial creation
 */

import React, { Suspense } from 'react';
import Link from 'next/link';
import { requireStudentSession } from '@/lib/auth';
import { getDevelopingTopics } from '@/lib/mastery/topicProgress';
import { Card, Pill, Button, Ring, ReadinessPill, readinessTier } from '@/components/UI/design-system';
import type { TopicProgress } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revise - Spinzy Academy' };

const TOPIC_LIMIT = 20;

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'Not yet studied';
  const diffMs = Date.now() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  return `${diffDays} days ago`;
}

function toReadableTitle(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function TopicCard({ topic }: { topic: TopicProgress }) {
  const scorePct = Math.round(topic.score * 100);
  const tier = readinessTier(scorePct);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <Ring percent={scorePct} size="sm" colorVar="--color-primary">
            <span className="text-[10px] font-bold tabular-nums text-[--color-primary]">
              {scorePct}%
            </span>
          </Ring>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
              {toReadableTitle(topic.topicSlug)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {topic.subject} &middot; {formatRelativeTime(topic.lastStudiedAt)}
            </p>
            <div className="mt-1.5">
              <ReadinessPill tier={tier} />
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          <Link href={`/dashboard/tests?topic=${encodeURIComponent(topic.topicSlug)}&subject=${encodeURIComponent(topic.subject)}`}>
            <Button variant="ghost">Resume</Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-[--color-purple-bg] flex items-center justify-center mb-4">
        <span className="text-2xl" aria-hidden>&#10003;</span>
      </div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        All caught up!
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
        You have no topics in progress right now. Start a new practice session to build your skills.
      </p>
      <Link href="/dashboard/tests">
        <Button variant="primary">Go to Practice</Button>
      </Link>
    </div>
  );
}

async function ReviseContent() {
  const session = await requireStudentSession();
  if (!session?.user?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sign in to see your revision list.
        </p>
        <Link href="/auth/signin">
          <Button variant="primary">Sign in</Button>
        </Link>
      </div>
    );
  }

  let topics: TopicProgress[] = [];
  let fetchError = false;

  try {
    topics = await getDevelopingTopics(session.user.id, TOPIC_LIMIT);
  } catch {
    fetchError = true;
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Couldn&apos;t load your revision list. Tap to retry.
        </p>
        <Link href="/dashboard/revise">
          <Button variant="ghost">Retry</Button>
        </Link>
      </div>
    );
  }

  if (topics.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-3">
      {topics.map((topic) => (
        <TopicCard key={topic.id} topic={topic} />
      ))}
    </div>
  );
}

function ReviseSkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 animate-pulse"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
            </div>
            <div className="w-20 h-9 bg-gray-100 dark:bg-gray-800 rounded-lg flex-shrink-0" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RevisePage() {
  return (
    <main className="max-w-[640px] mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Revise</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Topics you are building mastery on, sorted by time since last practice.
        </p>
      </div>
      <Suspense fallback={<ReviseSkeletonList />}>
        <ReviseContent />
      </Suspense>
    </main>
  );
}
