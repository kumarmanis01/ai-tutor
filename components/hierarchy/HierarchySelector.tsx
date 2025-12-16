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

// Small helper to safely map nested children
function mapOptions(items: any[] | undefined, idKey = "id", labelKey = "name") {
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({ id: it[idKey], label: it[labelKey], raw: it }));
}

type Props = {
  scope?: "TOPIC" | "CHAPTER" | "SUBJECT";
  onChange?: (selection: any) => void;
};

// HierarchySelector renders a simple column of selects (Board → Class → Subject → Chapter → Topic)
// It uses the shared HierarchyContext to read data and update selection.
export default function HierarchySelector({ scope = "TOPIC", onChange }: Props) {
  const { hierarchy, selection, setSelection, loading, languages } = useHierarchy();

  // mark `scope` as intentionally unused for now to satisfy lint rules
  void scope;

  // Defensive: if hierarchy missing, render a loader message
  if (loading) return <div>Loading hierarchy…</div>;
  if (!hierarchy) return <div>No hierarchy data available</div>;

  const boards = mapOptions(hierarchy.boards || hierarchy, "id", "name");

  // Find dynamic lists based on selection
  const selectedBoard = boards.find((b) => b.id === selection.boardId)?.raw;
  const classes = mapOptions(selectedBoard?.classes, "id", "grade");

  const selectedClass = (selectedBoard?.classes || []).find((c: any) => c.id === selection.classId);
  const subjects = mapOptions(selectedClass?.subjects, "id", "name");

  const selectedSubject = (selectedClass?.subjects || []).find((s: any) => s.id === selection.subjectId);
  const chapters = mapOptions(selectedSubject?.chapters, "id", "name");

  const selectedChapter = (selectedSubject?.chapters || []).find((ch: any) => ch.id === selection.chapterId);
  const topics = mapOptions(selectedChapter?.topics, "id", "name");

  const update = (patch: Partial<Record<string, string>>) => {
    setSelection((prev) => {
      const next = { ...prev, ...patch };
      // Reset deeper selections when higher-level changes
      if (patch.boardId) {
        next.classId = undefined;
        next.subjectId = undefined;
        next.chapterId = undefined;
        next.topicId = undefined;
      }
      if (patch.classId) {
        next.subjectId = undefined;
        next.chapterId = undefined;
        next.topicId = undefined;
      }
      if (patch.subjectId) {
        next.chapterId = undefined;
        next.topicId = undefined;
      }
      if (patch.chapterId) {
        next.topicId = undefined;
      }
      if (onChange) onChange(next);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium">Language</label>
        <select
          name="language"
          value={selection.language ?? ""}
          onChange={(e) => update({ language: e.target.value || undefined })}
          className="w-full border rounded p-2"
        >
          <option value="">Select Language</option>
          {(languages || ["English", "Hindi"]).map((l: string) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">Board</label>
        <select
          name="board"
          value={selection.boardId ?? ""}
          onChange={(e) => update({ boardId: e.target.value || undefined })}
          className="w-full border rounded p-2"
        >
          <option value="">Select Board</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Class</label>
        <select
          name="class"
          value={selection.classId ?? ""}
          onChange={(e) => update({ classId: e.target.value || undefined })}
          className="w-full border rounded p-2"
          disabled={!selection.boardId}
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Subject</label>
        <select
          name="subject"
          value={selection.subjectId ?? ""}
          onChange={(e) => update({ subjectId: e.target.value || undefined })}
          className="w-full border rounded p-2"
          disabled={!selection.classId}
        >
          <option value="">Select Subject</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Chapter</label>
        <select
          name="chapter"
          value={selection.chapterId ?? ""}
          onChange={(e) => update({ chapterId: e.target.value || undefined })}
          className="w-full border rounded p-2"
          disabled={!selection.subjectId}
        >
          <option value="">Select Chapter</option>
          {chapters.map((ch) => (
            <option key={ch.id} value={ch.id}>{ch.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Topic</label>
        <select
          name="topic"
          value={selection.topicId ?? ""}
          onChange={(e) => update({ topicId: e.target.value || undefined })}
          className="w-full border rounded p-2"
          disabled={!selection.chapterId}
        >
          <option value="">Select Topic</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
