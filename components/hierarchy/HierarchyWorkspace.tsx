/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

"use client";
import React from "react";
import { HierarchyProvider } from "./HierarchyContext";
import HierarchySelector from "./HierarchySelector";
import HierarchyActions from "./HierarchyActions";
import HierarchySummary from "./HierarchySummary";

// HierarchyWorkspace composes the selector, actions, and summary into the
// two-column admin workspace described in the wireframe.
export default function HierarchyWorkspace() {
  return (
    <HierarchyProvider>
      <div className="p-6">
        <header className="mb-6">
          <h1 className="text-2xl font-bold">Content Hierarchy & Generation Engine</h1>
        </header>

        <div className="grid grid-cols-3 gap-6">
          {/* LEFT: Hierarchy selector */}
          <div className="col-span-1">
            <div className="border rounded p-4">
              <h2 className="font-semibold mb-3">Curriculum Hierarchy</h2>
              <HierarchySelector />
            </div>
          </div>

          {/* RIGHT: Actions + Summary stacked */}
          <div className="col-span-2 space-y-6">
            <HierarchyActions />
            <HierarchySummary />
          </div>
        </div>
      </div>
    </HierarchyProvider>
  );
}
