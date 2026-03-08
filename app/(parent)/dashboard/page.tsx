/**
 * FILE OBJECTIVE:
 * - Parent Progress Dashboard page.
 * - Displays four sections: Weekly Study Activity, Subject Mastery,
 *   Weak Topics, and Improvement Trend.
 * - Renders placeholder components only; no API calls yet.
 *
 * Route: /app/(parent)/dashboard
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Spinzy Academy parent dashboard
 */

import type { Metadata } from 'next';
import ParentWeeklyActivity from '@/components/parent/ParentWeeklyActivity';
import ParentSubjectMastery from '@/components/parent/ParentSubjectMastery';
import ParentWeakTopics from '@/components/parent/ParentWeakTopics';
import ParentImprovementTrend from '@/components/parent/ParentImprovementTrend';

export const metadata: Metadata = {
  title: "Progress Dashboard | Spinzy Academy",
  description: "Track your child's weekly activity, subject mastery, weak topics, and improvement trends.",
};

export default function ParentProgressDashboard() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Page header ── */}
      <header className="border-b border-gray-100 bg-white px-6 py-5">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-medium uppercase tracking-widest text-indigo-500">
            Spinzy Academy
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">
            Progress Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            A snapshot of your child&apos;s learning activity this week.
          </p>
        </div>
      </header>

      {/* ── Dashboard grid ── */}
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">

          {/* 1. Weekly Study Activity */}
          <ParentWeeklyActivity />

          {/* 2. Subject Mastery */}
          <ParentSubjectMastery />

          {/* 3. Weak Topics */}
          <ParentWeakTopics />

          {/* 4. Improvement Trend */}
          <ParentImprovementTrend />

        </div>
      </div>

    </main>
  );
}
