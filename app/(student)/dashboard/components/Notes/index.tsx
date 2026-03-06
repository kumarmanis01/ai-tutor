'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useCurrentUser from '@/hooks/useCurrentUser';
import { useAcademicHierarchy } from '@/hooks/useAcademicHierarchy';
import type { HierarchySubject, HierarchyChapter, HierarchyTopic } from '@/hooks/useAcademicHierarchy';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ActiveSessionTopic {
  sessionId: string;
  topicId: string;
  topicName: string;
  chapter: string;
  subject: string;
  phase: string;
}

interface WeakTopicEntry {
  topicId: string;
  topicName: string;
  chapter: string;
  subject: string;
  mastery: number;
  practiceCount: number;
}

interface TopicNoteData {
  id: string;
  title: string;
  contentJson: unknown;
  language: string;
  version: number;
}

const PHASE_LABELS: Record<string, string> = {
  EXPLANATION: 'Reading notes',
  PRACTICE: 'Practicing',
  TEST: 'Taking a test',
  HOMEWORK: 'Doing homework',
};

// ─── Main Component ─────────────────────────────────────────────────────────

export default function NotesTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: profile } = useCurrentUser();
  const { helpers, loading: hierarchyLoading } = useAcademicHierarchy();

  const [activeTopics, setActiveTopics] = useState<ActiveSessionTopic[]>([]);
  const [weakTopics, setWeakTopics] = useState<WeakTopicEntry[]>([]);
  const [overviewLoading, setOverviewLoading] = useState(true);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [selectedTopicName, setSelectedTopicName] = useState<string>('');
  const [note, setNote] = useState<TopicNoteData | null>(null);
  const [noteLoading, setNoteLoading] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Capture URL params once at mount so the ref stays stable
  const initialTopicId = useRef(searchParams.get('topicId'));
  const initialTopicName = useRef(searchParams.get('topicName') ?? '');

  // ── Fetch overview data ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    fetch('/api/notes/topics-overview')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setActiveTopics(data?.activeSessionTopics ?? []);
        setWeakTopics(data?.weakTopics ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setOverviewLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // ── Load TopicNote when a topic is selected ───────────────────────────
  const selectTopic = useCallback((topicId: string, topicName: string) => {
    setSelectedTopicId(topicId);
    setSelectedTopicName(topicName);
    setNote(null);
    setNoteError(null);
    setNoteLoading(true);

    fetch(`/api/notes/for-topic?topicId=${encodeURIComponent(topicId)}`)
      .then((r) => r.json())
      .then(async (data) => {
        const notes = data?.notes as { id: string; title: string; language: string; version: number }[];
        if (!notes || notes.length === 0) {
          setNoteError('No notes available for this topic yet.');
          setNoteLoading(false);
          return;
        }
        // Pick the latest English note, or first available
        const pick = notes.find((n) => n.language === 'en') ?? notes[0];
        const full = await fetch(`/api/notes/topic-note/${pick.id}`).then((r) => r.json());
        setNote({
          id: full.id ?? pick.id,
          title: full.title ?? pick.title,
          contentJson: full.contentJson ?? null,
          language: pick.language,
          version: pick.version,
        });
        setNoteLoading(false);
      })
      .catch(() => {
        setNoteError('Failed to load notes.');
        setNoteLoading(false);
      });
  }, []);

  // Auto-open a topic when landing with ?topicId= (e.g. from TopicCompletionModal)
  useEffect(() => {
    if (initialTopicId.current) {
      selectTopic(initialTopicId.current, initialTopicName.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectTopic]);

  const clearSelection = useCallback(() => {
    setSelectedTopicId(null);
    setSelectedTopicName('');
    setNote(null);
    setNoteError(null);
    // Remove the topicId param from the URL without a full navigation
    const url = new URL(window.location.href);
    url.searchParams.delete('topicId');
    url.searchParams.delete('topicName');
    window.history.replaceState(null, '', url.toString());
  }, []);

  // ── Hierarchy data ────────────────────────────────────────────────────
  const subjects = helpers.getSubjectsForGrade(profile?.board, profile?.grade);

  // ── If a note is selected, show the reader ────────────────────────────
  if (selectedTopicId) {
    return (
      <div className="space-y-4 px-3 sm:px-4 py-4">
        <button
          type="button"
          onClick={clearSelection}
          className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <ChevronLeftIcon />
          Back to topics
        </button>

        <h1 className="text-xl font-bold">{selectedTopicName}</h1>

        {noteLoading && <NoteSkeleton />}

        {noteError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            {noteError}
          </div>
        )}

        {note && <NoteRenderer content={note.contentJson} title={note.title} />}
      </div>
    );
  }

  // ── Topic listing ─────────────────────────────────────────────────────
  return (
    <div className="space-y-8 px-3 sm:px-4 py-4">
      <div className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold">Notes</h1>
        <p className="text-sm text-gray-500">Select a topic to study</p>
      </div>

      {/* Section 1: Continue Learning */}
      {overviewLoading ? (
        <SectionSkeleton />
      ) : activeTopics.length > 0 ? (
        <section>
          <SectionHeading title="Continue Learning" accent="indigo" />
          <div className="grid gap-3 sm:grid-cols-2">
            {activeTopics.map((t) => (
              <button
                key={t.sessionId}
                type="button"
                onClick={() => router.push(`/session/${t.sessionId}`)}
                className="text-left rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {PHASE_LABELS[t.phase] ?? t.phase}
                </p>
                <h3 className="mt-1 text-base font-bold text-gray-900 truncate">
                  {t.topicName}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  {t.subject} &middot; {t.chapter}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Section 2: Weak Topics */}
      {overviewLoading ? null : weakTopics.length > 0 ? (
        <section>
          <SectionHeading title="Weak Topics" accent="amber" />
          <div className="grid gap-3 sm:grid-cols-2">
            {weakTopics.map((t) => (
              <button
                key={t.topicId}
                type="button"
                onClick={() => selectTopic(t.topicId, t.topicName)}
                className="text-left rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900 truncate">
                    {t.topicName}
                  </h3>
                  <MasteryBadge mastery={t.mastery} />
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {t.subject} &middot; {t.chapter}
                </p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* Section 3: Browse by Subject */}
      <section>
        <SectionHeading title="Browse by Subject" accent="gray" />
        {hierarchyLoading ? (
          <SectionSkeleton />
        ) : subjects.length === 0 ? (
          <p className="text-sm text-gray-400">No subjects found for your profile.</p>
        ) : (
          <div className="space-y-2">
            {subjects.map((sub) => (
              <SubjectAccordion
                key={sub.id}
                subject={sub}
                helpers={helpers}
                onSelectTopic={selectTopic}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SectionHeading({ title, accent }: { title: string; accent: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500',
    amber: 'bg-amber-500',
    gray: 'bg-gray-400',
  };
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`inline-block w-2 h-2 rounded-full ${colors[accent] ?? 'bg-gray-400'}`} aria-hidden />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-600">{title}</h2>
    </div>
  );
}

function MasteryBadge({ mastery }: { mastery: number }) {
  const pct = Math.round(mastery * 100);
  return (
    <span className="shrink-0 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
      {pct}%
    </span>
  );
}

// ── Subject → Chapter → Topic accordion ─────────────────────────────────

function SubjectAccordion({
  subject,
  helpers,
  onSelectTopic,
}: {
  subject: HierarchySubject;
  helpers: ReturnType<typeof useAcademicHierarchy>['helpers'];
  onSelectTopic: (topicId: string, topicName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const chapters = helpers.getChaptersForSubject(subject.id);

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <span className="text-sm font-semibold text-gray-800">{subject.name}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="divide-y divide-gray-100">
          {chapters.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">No chapters found</p>
          ) : (
            chapters.map((ch) => (
              <ChapterAccordion
                key={ch.id}
                chapter={ch}
                helpers={helpers}
                onSelectTopic={onSelectTopic}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ChapterAccordion({
  chapter,
  helpers,
  onSelectTopic,
}: {
  chapter: HierarchyChapter;
  helpers: ReturnType<typeof useAcademicHierarchy>['helpers'];
  onSelectTopic: (topicId: string, topicName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const topics: HierarchyTopic[] = helpers.getTopicsForChapter(chapter.id);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm text-gray-700">
          <span className="text-gray-400 mr-1.5">{chapter.order}.</span>
          {chapter.name}
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="pl-10 pr-4 pb-2 space-y-1">
          {topics.length === 0 ? (
            <p className="text-xs text-gray-400 py-1">No topics found</p>
          ) : (
            topics.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTopic(t.id, t.name)}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
              >
                {t.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Note renderer ────────────────────────────────────────────────────────

function NoteRenderer({ content, title }: { content: unknown; title: string }) {
  if (!content) {
    return (
      <div className="rounded-lg border p-6 text-sm text-gray-500">
        Note content is empty.
      </div>
    );
  }

  // contentJson can be a structured object with sections, or plain text
  if (typeof content === 'string') {
    return (
      <article className="prose prose-sm max-w-none rounded-lg border bg-white p-6">
        <h2>{title}</h2>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </article>
    );
  }

  if (typeof content === 'object' && content !== null) {
    const obj = content as Record<string, unknown>;

    // Handle array-of-sections format
    if (Array.isArray(obj.sections)) {
      return (
        <article className="space-y-6 rounded-lg border bg-white p-6">
          {obj.objectives && Array.isArray(obj.objectives) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Learning Objectives
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                {(obj.objectives as string[]).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          {(obj.sections as Array<Record<string, unknown>>).map((sec, i) => (
            <div key={i}>
              {sec.heading && (
                <h3 className="text-base font-bold text-gray-900 mb-2">
                  {String(sec.heading)}
                </h3>
              )}
              {sec.content && (
                <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {String(sec.content)}
                </div>
              )}
              {sec.points && Array.isArray(sec.points) && (
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-gray-700">
                  {(sec.points as string[]).map((p, j) => (
                    <li key={j}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          {obj.keyPoints && Array.isArray(obj.keyPoints) && (
            <div className="rounded-lg bg-indigo-50 border border-indigo-100 p-4">
              <h3 className="text-sm font-semibold text-indigo-700 mb-2">Key Points</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-indigo-800">
                {(obj.keyPoints as string[]).map((k, i) => (
                  <li key={i}>{k}</li>
                ))}
              </ul>
            </div>
          )}
        </article>
      );
    }

    // Fallback: render as formatted JSON
    return (
      <article className="rounded-lg border bg-white p-6">
        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto">
          {JSON.stringify(content, null, 2)}
        </pre>
      </article>
    );
  }

  return (
    <div className="rounded-lg border p-6 text-sm text-gray-500">
      Unable to render note content.
    </div>
  );
}

// ── Skeletons & Icons ────────────────────────────────────────────────────

function SectionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-20 bg-gray-100 rounded-xl" />
        <div className="h-20 bg-gray-100 rounded-xl" />
      </div>
    </div>
  );
}

function NoteSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-64 bg-gray-200 rounded" />
      <div className="h-4 w-full bg-gray-100 rounded" />
      <div className="h-4 w-5/6 bg-gray-100 rounded" />
      <div className="h-4 w-4/6 bg-gray-100 rounded" />
      <div className="h-4 w-full bg-gray-100 rounded" />
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}
