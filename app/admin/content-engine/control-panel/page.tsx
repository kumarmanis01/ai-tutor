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
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { alerts } from "@/lib/alerts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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

  const { data: boards } = useSWR("/api/boards", fetcher);
  const { data: classes } = useSWR(
    form.board ? `/api/classes?boardId=${form.board}` : null,
    fetcher
  );
  const { data: subjects } = useSWR(
    form.classLevel ? `/api/subjects?classId=${form.classLevel}` : null,
    fetcher
  );
  const { data: topics } = useSWR(
    form.subject ? `/api/topics?subjectId=${form.subject}` : null,
    fetcher
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
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
          <label className="block font-semibold mb-1">Board:</label>
          <select name="board" value={form.board} onChange={handleChange} className="w-full border rounded p-2" required>
            <option value="">Select Board</option>
            {boards?.boards?.map((b: any) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Class:</label>
          <select name="classLevel" value={form.classLevel} onChange={handleChange} className="w-full border rounded p-2" required disabled={!form.board}>
            <option value="">Select Class</option>
            {classes?.classes?.map((c: any) => (
              <option key={c.id} value={c.id}>{c.grade}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Subject:</label>
          <select name="subject" value={form.subject} onChange={handleChange} className="w-full border rounded p-2" required disabled={!form.classLevel}>
            <option value="">Select Subject</option>
            {subjects?.subjects?.map((s: any) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-semibold mb-1">Topic:</label>
          <select name="topic" value={form.topic} onChange={handleChange} className="w-full border rounded p-2" required disabled={!form.subject}>
            <option value="">Select Topic</option>
            {topics?.topics?.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
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
