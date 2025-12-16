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

import React from "react";
import dynamic from "next/dynamic";

// Load the client component dynamically to keep this page a server component
// while still running the workspace on the client.
const HierarchyWorkspace = dynamic(() => import("@/components/hierarchy/HierarchyWorkspace"), {
  ssr: false,
});

export default function ControlPanelHierarchyPage() {
  return (
    <main className="p-6">
      <HierarchyWorkspace />
    </main>
  );
}
