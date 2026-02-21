'use client';
/**
 * FILE OBJECTIVE:
 * - Dropdown-driven notes browser: Subject → Chapter → Topic → Open Notes.
 * - Loads chapters and topics on-demand only. No full curriculum pre-fetch.
 *
 * EDIT LOG:
 * - 2026-02-21 | claude | created per refactor spec
 */
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import useCurrentUser from '@/hooks/useCurrentUser';

interface SubjectOption { id: string; name: string; slug: string; }
interface ChapterOption { id: string; name: string; }
interface TopicOption  { id: string; name: string; }

export default function BrowseNotesSection() {
  const { data: profile, loading: profileLoading } = useCurrentUser();

  const [subjects, setSubjects]   = useState<SubjectOption[]>([]);
  const [chapters, setChapters]   = useState<ChapterOption[]>([]);
  const [topics,   setTopics]     = useState<TopicOption[]>([]);

  const [subjectId, setSubjectId] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId,   setTopicId]   = useState('');

  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingTopics,   setLoadingTopics]   = useState(false);

  // Load subjects from user profile once profile is ready
  useEffect(() => {
    if (!profile?.board || !profile?.grade) return;

    const grade = parseInt(String(profile.grade), 10);
    if (isNaN(grade)) return;

    fetch(`/api/subjects/for-selection?boardSlug=${encodeURIComponent(profile.board)}&gradeNum=${grade}`)
      .then((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data?.subjects) ? data.subjects : []))
      .catch(() => setSubjects([]));
  }, [profile?.board, profile?.grade]);

  // Fetch chapters when subject changes
  const handleSubjectChange = useCallback(async (id: string) => {
    setSubjectId(id);
    setChapterId('');
    setTopicId('');
    setChapters([]);
    setTopics([]);

    if (!id) return;
    setLoadingChapters(true);
    try {
      const res = await fetch(`/api/curriculum?subjectId=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      setChapters(Array.isArray(data?.chapters) ? data.chapters : []);
    } finally {
      setLoadingChapters(false);
    }
  }, []);

  // Fetch topics when chapter changes
  const handleChapterChange = useCallback(async (id: string) => {
    setChapterId(id);
    setTopicId('');
    setTopics([]);

    if (!id) return;
    setLoadingTopics(true);
    try {
      const res = await fetch(`/api/curriculum?chapterId=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      setTopics(Array.isArray(data?.topics) ? data.topics : []);
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  if (profileLoading) {
    return (
      <div className="bg-card border border-border rounded-lg p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-32 mb-3" />
        <div className="h-9 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <h2 className="text-sm font-semibold text-foreground mb-4">Browse Notes</h2>

      <div className="space-y-3">
        {/* Step 1: Subject */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Subject</label>
          <select
            value={subjectId}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {subjects.length === 0 && !profileLoading && profile?.board && (
            <p className="text-xs text-muted-foreground mt-1">No subjects found for your profile.</p>
          )}
        </div>

        {/* Step 2: Chapter (shown after subject is selected) */}
        {subjectId && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Chapter</label>
            {loadingChapters ? (
              <div className="h-9 bg-muted rounded animate-pulse" />
            ) : (
              <select
                value={chapterId}
                onChange={(e) => handleChapterChange(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a chapter</option>
                {chapters.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Step 3: Topic (shown after chapter is selected) */}
        {chapterId && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Topic</label>
            {loadingTopics ? (
              <div className="h-9 bg-muted rounded animate-pulse" />
            ) : (
              <select
                value={topicId}
                onChange={(e) => setTopicId(e.target.value)}
                className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select a topic</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* CTA: Open notes for selected topic */}
        {topicId && (
          <Link
            href={`/learn/${encodeURIComponent(topicId)}`}
            className="inline-block mt-1 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded hover:bg-primary/90 transition-colors"
          >
            Open Notes &rarr;
          </Link>
        )}
      </div>
    </div>
  );
}
