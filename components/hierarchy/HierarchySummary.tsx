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
import { useHierarchy } from "./HierarchyContext";

// HierarchySummary shows a compact read-only overview of selected node
export default function HierarchySummary() {
  const { hierarchy, selection } = useHierarchy();

  const board = hierarchy?.boards?.find((b: any) => b.id === selection.boardId);
  const classObj = board?.classes?.find((c: any) => c.id === selection.classId);
  const subject = classObj?.subjects?.find((s: any) => s.id === selection.subjectId);
  const chapter = subject?.chapters?.find((ch: any) => ch.id === selection.chapterId);
  const topic = chapter?.topics?.find((t: any) => t.id === selection.topicId);

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Selected Node</h3>
      <div className="text-sm text-gray-700 space-y-1">
        <div><strong>Board:</strong> {board?.name ?? "—"}</div>
        <div><strong>Class:</strong> {classObj?.grade ?? classObj?.name ?? "—"}</div>
        <div><strong>Subject:</strong> {subject?.name ?? "—"}</div>
        <div><strong>Chapter:</strong> {chapter?.name ?? "—"}</div>
        <div><strong>Topic:</strong> {topic?.name ?? "—"}</div>
        <div><strong>Language:</strong> {selection.language ?? "—"}</div>
      </div>

      <div className="mt-4">
        <h4 className="font-medium">Existing Content</h4>
        <p className="text-sm text-gray-600">Notes: ✅ Hindi | ❌ English (placeholder)</p>
        <p className="text-sm text-gray-600">Questions: 42 (Easy 10 | Medium 22 | Hard 10) — placeholder</p>
        <p className="text-sm text-gray-600">Tests: 3 drafts — placeholder</p>
      </div>
    </div>
  );
}
