/**
 * FILE OBJECTIVE:
 * - A4.1: Executive Analytics Dashboard -- admin entry point at /admin/analytics.
 *   Shows high-level KPIs, active users, content pipeline, and top topics.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/analytics/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created A4.1 executive analytics page
 */

import React from 'react';
import { redirect } from 'next/navigation';
import { requireActiveAdmin } from '@/lib/admin/guards';
import { AnalyticsDashboardClient } from './AnalyticsDashboardClient';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage() {
  const guard = await requireActiveAdmin();
  if (!guard.ok) redirect('/admin/login');

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Executive overview of platform performance. Data cached for 5 minutes.
        </p>
      </div>
      <AnalyticsDashboardClient />
    </div>
  );
}
