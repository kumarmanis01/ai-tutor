/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 *
 * ⚠️ DO NOT:
 * - Call LLMs directly
 * - Mutate jobs after creation
 * - Add progress tracking
 * - Use router.refresh() with SWR
 */

/**
 * Control Panel — Hierarchy Workspace
 * This page wires the HierarchyWorkspace into the admin control-panel area.
 * It intentionally renders a client-side `HierarchyWorkspace` component that
 * fetches `/api/hierarchy` and provides actions for content generation.
 */

import React from 'react';
import HierarchyWorkspaceClient from '@/components/ClientOnly/HierarchyWorkspaceClient';

export default function ControlPanelHierarchyPage() {
  return (
    <main className="p-6">
      <HierarchyWorkspaceClient />
    </main>
  );
}
