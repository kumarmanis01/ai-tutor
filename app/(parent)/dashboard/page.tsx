/**
 * FILE OBJECTIVE:
 * - Parent Progress Dashboard page.
 * - Composes four live self-fetching client components in a responsive 2-column
 *   grid: Weekly Activity, Subject Mastery, Weak Topics, Improvement Trend.
 *
 * RENDERING STRATEGY:
 * - This page is a React Server Component (RSC). It renders synchronously on
 *   the server and ships static HTML for the shell (header, grid layout) with
 *   zero blocking data fetches at the page level.
 * - Each card component is "use client" and owns its own fetch lifecycle,
 *   so the four API calls fire in parallel from the browser after hydration.
 *   No single slow card blocks the others from rendering.
 * - `export const dynamic = 'force-dynamic'` is intentionally omitted: the
 *   page shell has no server-side data, so Next.js can statically render it
 *   and serve it from the CDN edge. Only the client components fetch at runtime.
 *
 * Route: /parent/dashboard
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Spinzy Academy parent dashboard
 * - 2026-03-08 | claude | integrated all four live components; updated header
 */

import type { Metadata } from 'next';
import ParentWeeklyActivity from '@/components/parent/ParentWeeklyActivity';
import ParentSubjectMastery from '@/components/parent/ParentSubjectMastery';
import ParentWeakTopics from '@/components/parent/ParentWeakTopics';
import ParentImprovementTrend from '@/components/parent/ParentImprovementTrend';

export const metadata: Metadata = {
  title: "Your Child's Learning Progress | Spinzy Academy",
  description: "Track your child's weekly activity, subject mastery, weak topics, and improvement trends.",
};

export default function ParentProgressDashboard() {
  return (
    <main className="min-h-screen bg-gray-50">

      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-100 bg-white px-6 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Brand eyebrow */}
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
            Spinzy Academy
          </p>

          {/* Primary heading — per spec */}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
            Your Child&apos;s Learning Progress
          </h1>

          {/* Supportive sub-text */}
          <p className="mt-1 text-sm text-gray-500">
            A weekly snapshot across all subjects — updated in real time.
          </p>
        </div>
      </header>

      {/* ── Section label ────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-6 pt-8 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          This week
        </h2>
      </div>

      {/* ── Dashboard grid ───────────────────────────────────────────────────── */}
      {/*
        grid-cols-1 on mobile  → each card stacks full-width, easiest to read
        md:grid-cols-2         → two-column layout from 768 px and up
        gap-6                  → 24 px gutter matches card padding rhythm
        Cards are ordered to pair naturally on desktop:
          [Weekly Activity]  [Subject Mastery]
          [Weak Topics]      [Improvement Trend]
      */}
      <div className="mx-auto max-w-5xl px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* 1. Weekly Study Activity — study time, sessions, topics this week */}
          <ParentWeeklyActivity />

          {/* 2. Subject Mastery — accuracy per subject, all time */}
          <ParentSubjectMastery />

          {/* 3. Weak Topics — up to 5 topics needing attention */}
          <ParentWeakTopics />

          {/* 4. Improvement Trend — 8-week accuracy line chart */}
          <ParentImprovementTrend />

        </div>
      </div>

    </main>
  );
}
