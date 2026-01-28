/**
 * AI CONTENT ENGINE NOTICE:
 * - Job-based execution only
 * - No per-job pause/resume
 * - No streaming or progress tracking
 * - All AI calls are atomic and retryable
 * - Content requires admin approval
 */

"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { useHierarchy } from "./HierarchyContext";
import { alerts } from "@/lib/alerts";
import { logger } from "@/lib/logger";

type Props = {
  // selection is available via context but accept prop for convenience
  selection?: any;
};

// Helper to determine entity type from selection (deepest selected level)
function resolveEntity(selection: any) {
  if (selection?.topicId) return { entityType: "TOPIC", entityId: selection.topicId };
  if (selection?.chapterId) return { entityType: "CHAPTER", entityId: selection.chapterId };
  if (selection?.subjectId) return { entityType: "SUBJECT", entityId: selection.subjectId };
  if (selection?.classId) return { entityType: "CLASS", entityId: selection.classId };
  if (selection?.boardId) return { entityType: "BOARD", entityId: selection.boardId };
  return { entityType: undefined, entityId: undefined };
}

export default function HierarchyActions({ selection: propSelection }: Props) {
  const router = useRouter();
  const { selection: ctxSelection } = useHierarchy();
  const selection = propSelection ?? ctxSelection;
  const [submitting, setSubmitting] = useState(false);

  const enqueueJob = async (jobType: string) => {
    const { entityType, entityId } = resolveEntity(selection);
    if (!entityType || !entityId) return alerts.warning("Please select a scope before running this action.");

    setSubmitting(true);
    try {
      // Require language selection for content-generation actions
      if (!selection?.language) {
        alerts.warning('Please select a language before running this action.');
        setSubmitting(false);
        return;
      }

      const payload: any = {
        jobType,
        entityType,
        entityId,
        language: selection.language,
        // include selected academic IDs for extra context
        boardId: selection?.boardId ?? null,
        classId: selection?.classId ?? null,
        subjectId: selection?.subjectId ?? null,
        chapterId: selection?.chapterId ?? null,
        topicId: selection?.topicId ?? null,
      };

      // Log the outgoing payload for debugging (server will also validate)
      logger.info('HierarchyActions: enqueueing job', { payload });

      const res = await fetch('/api/admin/content-engine/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("enqueue_failed");
      const { jobId } = await res.json();
      alerts.success(`${jobType} job created`);
    router.push(`/admin/content-engine/jobs/${jobId}`);
    } catch (err) {
      alerts.error(`Failed to enqueue ${jobType}.`);
      (logger as any).error(err, `Failed to enqueue ${jobType}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold mb-2">Actions</h3>
      <p className="text-sm text-gray-600 mb-3">Selected scope: {selection.topicId ? "Topic" : selection.chapterId ? "Chapter" : selection.subjectId ? "Subject" : selection.classId ? "Class" : selection.boardId ? "Board" : "None"}</p>

      <div className="flex flex-col gap-2">
        <button className="px-3 py-2 bg-blue-600 text-white rounded" disabled={submitting} onClick={() => enqueueJob("GENERATE_NOTES")}>Generate Notes</button>
        <button className="px-3 py-2 bg-green-600 text-white rounded" disabled={submitting} onClick={() => enqueueJob("GENERATE_QUESTIONS")}>Generate Questions</button>
        <button className="px-3 py-2 bg-indigo-600 text-white rounded" disabled={submitting} onClick={() => enqueueJob("GENERATE_TEST")}>Generate Test</button>
        <hr className="my-2" />
        <button className="px-3 py-2 bg-yellow-600 text-white rounded" disabled={submitting} onClick={() => enqueueJob("SYLLABUS")}>Generate Syllabus (hydrate)</button>
        <div className="text-sm text-gray-600 mt-2">
          If chapters don't appear after generation, you can requeue the job from the <Link href="/admin/content-engine/jobs" className="underline text-blue-600">Jobs</Link> page (select the failed job and click Requeue).
        </div>
        <button className="px-3 py-2 bg-gray-200 rounded text-gray-800" disabled={submitting} onClick={() => alerts.info("Assemble test — action placeholder")}>Assemble Test</button>
      </div>
    </div>
  );
}
