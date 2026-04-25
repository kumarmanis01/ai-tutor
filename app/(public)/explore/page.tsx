/**
 * FILE OBJECTIVE:
 * - Server wrapper for the /explore page. Suspense boundary required because
 *   ExploreModeClient uses useSearchParams (Client Component).
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/explore/page.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-24T00:00:00Z | copilot | created
 */

import { Suspense } from 'react';
import ExploreModeClient from '@/components/student/explore/ExploreModeClient';

export const dynamic = 'force-dynamic';

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-slate-950" />}>
      <ExploreModeClient />
    </Suspense>
  );
}
