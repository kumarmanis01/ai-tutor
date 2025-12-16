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
import InlineSpinner from "@/components/UI/InlineSpinner";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { alerts } from "@/lib/alerts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// API shapes used by this control panel. Endpoints historically returned
// either a top-level array (preferred) or an object wrapper like { boards: [...] }.
type Board = { id: string; name: string; slug: string; classes?: ClassLevel[] };
type ClassLevel = { id: string; grade: number; slug: string; boardId: string; subjects?: SubjectDef[] };
type SubjectDef = { id: string; name: string; slug: string; classId: string };
type TopicDef = { id: string; name: string; slug: string; chapterId?: string };

const contentTypes = [
  { value: "GENERATE_NOTES", label: "Notes" },
  { value: "GENERATE_TEST", label: "Tests" },
  { value: "GENERATE_QUESTIONS", label: "Questions" },
];

export default function GenerationControlPanel() {
  const router = useRouter();
  const [form, setForm] = useState({
    board: "",
    classLevel: "",
    subject: "",
    topic: "",
    language: "Hindi",
    contentType: "GENERATE_NOTES",
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: boards, isLoading: boardsLoading } = useSWR<Board[] | { boards: Board[] }>("/api/boards", fetcher);
  const { data: classes, isLoading: classesLoading } = useSWR<ClassLevel[] | { classes: ClassLevel[] }>(
    form.board ? `/api/classes?boardId=${form.board}` : null,
    fetcher
  );
  const { data: subjects, isLoading: subjectsLoading } = useSWR<SubjectDef[] | { subjects: SubjectDef[] }>(
    form.classLevel ? `/api/subjects?classId=${form.classLevel}` : null,
    fetcher
  );
  const { data: topics, isLoading: topicsLoading } = useSWR<TopicDef[] | { topics: TopicDef[] }>(
    form.subject ? `/api/topics?subjectId=${form.subject}` : null,
    fetcher
  );

  // Defensive normalization: support both plain-array and wrapper-object responses.
  const boardsList: Board[] = Array.isArray(boards) ? boards : (boards?.boards ?? []);
  const classesList: ClassLevel[] = Array.isArray(classes) ? classes : (classes?.classes ?? []);
  const subjectsList: SubjectDef[] = Array.isArray(subjects) ? subjects : (subjects?.subjects ?? []);
  const topicsList: TopicDef[] = Array.isArray(topics) ? topics : (topics?.topics ?? []);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };

      if (name === "board") {
        next.classLevel = "";
        next.subject = "";
        next.topic = "";
      }

      if (name === "classLevel") {
        next.subject = "";
        next.topic = "";
      }

      if (name === "subject") {
        next.topic = "";
      }

      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.topic) {
      alerts.warning("Please select a topic before generating content.");
      return;
    }
    setSubmitting(true);
    const res = await fetch("/api/admin/content-engine/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobType: form.contentType,
        // Currently generation is topic-scoped only
        // Can be extended to SUBJECT / CHAPTER later
        entityType: "TOPIC",
        entityId: form.topic,
        language: form.language,
      }),
    });
    if (res.ok) {
      const { jobId } = await res.json();
      alerts.success("Content generation job created.");
      router.push(`/admin/content-engine/jobs/${jobId}`);
    } else {
      alerts.error("Failed to create generation job. Check audit logs.");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Generate AI Content</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-semibold mb-1">Board:{boardsLoading && <span className="ml-2 text-sm text-gray-500"><InlineSpinner size={14} /></span>}</label>
          <select name="board" value={form.board} onChange={handleChange} className="w-full border rounded p-2" required disabled={boardsLoading}>
            <option value="">Select Board</option>
            {boardsList.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Class:{classesLoading && <span className="ml-2 text-sm text-gray-500"><InlineSpinner size={14} /></span>}</label>
          <select name="classLevel" value={form.classLevel} onChange={handleChange} className="w-full border rounded p-2" required disabled={!form.board || classesLoading}>
            <option value="">Select Class</option>
            {classesList.map((c) => (
              <option key={c.id} value={c.id}>{c.grade}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Subject:{subjectsLoading && <span className="ml-2 text-sm text-gray-500"><InlineSpinner size={14} /></span>}</label>
          <select name="subject" value={form.subject} onChange={handleChange} className="w-full border rounded p-2" required disabled={!form.classLevel || subjectsLoading}>
            <option value="">Select Subject</option>
            {subjectsList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Topic:{topicsLoading && <span className="ml-2 text-sm text-gray-500"><InlineSpinner size={14} /></span>}</label>
          <select name="topic" value={form.topic} onChange={handleChange} className="w-full border rounded p-2" required disabled={!form.subject || topicsLoading || topicsList.length === 0}>
            <option value="">Select Topic</option>
            {topicsList.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {form.subject && !topicsLoading && topicsList.length === 0 && (
            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-sm text-gray-700">No topics found for this subject. Generate syllabus (chapters & topics) first.</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    setSubmitting(true);
                    const res = await fetch('/api/admin/content-engine/jobs', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        jobType: 'SYLLABUS',
                        entityType: 'SUBJECT',
                        entityId: form.subject,
                        language: form.language,
                      }),
                    });
                    if (res.ok) {
                      const { jobId } = await res.json();
                      alerts.success('Syllabus hydration job created.');
                      router.push(`/admin/content-engine/jobs/${jobId}`);
                    } else {
                      alerts.error('Failed to enqueue syllabus job.');
                    }
                    setSubmitting(false);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                  disabled={submitting}
                >
                  Generate Topics
                </button>
                <button type="button" className="px-3 py-1 bg-gray-100 rounded" onClick={() => alerts.info('Syllabus jobs create draft chapters & topics; approval required.')}>Why?</button>
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block font-semibold mb-1">Language:</label>
          <select name="language" value={form.language} onChange={handleChange} className="w-full border rounded p-2">
            <option value="Hindi">Hindi</option>
            <option value="English">English</option>
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Content Type:</label>
          <div className="flex gap-6">
            {contentTypes.map((ct) => (
              <label key={ct.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="contentType"
                  value={ct.value}
                  checked={form.contentType === ct.value}
                  onChange={handleChange}
                />
                {ct.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50" disabled={submitting}>Generate Content</button>
        </div>
      </form>
    </div>
  );
}
