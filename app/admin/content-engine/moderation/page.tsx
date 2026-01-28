"use client";

/**
 * FILE OBJECTIVE:
 * - DEPRECATED: This page now redirects to the unified /admin/content-approval page.
 * - All content review (syllabus, chapters, topics, notes, tests) is consolidated in one place.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/content-engine/moderation/page.test.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-24T00:00:00Z | copilot | Deprecated page with redirect to unified content-approval
 * - 2025-01-23T00:00:00Z | copilot | Made rows clickable with content preview and detail panel
 * - 2025-01-22T08:20:00Z | copilot | Refactored UI with professional styling, status badges, and empty state
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * @deprecated This page has been consolidated into /admin/content-approval
 * Keeping this file for backwards compatibility - it redirects to the unified page.
 */
export default function ModerationPageRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the unified content approval page with notes filter pre-selected
    router.replace('/admin/content-approval?filter=note');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center animate-pulse">
          <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Redirecting...</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Content moderation has moved to the unified{' '}
          <a href="/admin/content-approval" className="text-indigo-600 hover:underline">Content Review</a> page.
        </p>
      </div>
    </div>
  );
}
