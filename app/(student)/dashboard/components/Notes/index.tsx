/**
 * FILE OBJECTIVE:
 * - Render and browse Topic Notes for students; supports Vidya and legacy note shapes.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/student/dashboard/components/Notes/index.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-11T00:00:00Z | copilot | restore objectives rendering in legacy & flat renderers
 */
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
  // Single round-trip: /api/notes/topic-content returns the latest approved note with content.
  const selectTopic = useCallback((topicId: string, topicName: string) => {
    setSelectedTopicId(topicId);
    setSelectedTopicName(topicName);
    setNote(null);
    setNoteError(null);
    setNoteLoading(true);

    fetch(`/api/notes/topic-content?topicId=${encodeURIComponent(topicId)}`)
      .then((r) => r.json())
      .then((data) => {
        const n = data?.note as TopicNoteData | null;
        if (!n) {
          setNoteError('No notes available for this topic yet.');
          return;
        }
        setNote(n);
      })
      .catch(() => {
        setNoteError("Couldn't load notes -- tap to retry.");
      })
      .finally(() => setNoteLoading(false));
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
          className="inline-flex items-center gap-1 text-sm text-[#534AB7] hover:text-indigo-800"
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
                onClick={() => router.push(`/session/${t.topicId}`)}
                className="text-left rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-[#534AB7]">
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
    indigo: 'bg-[#534AB7]',
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
                className="w-full text-left px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-[#EEEDFE] hover:text-[#534AB7] transition-colors"
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

type VidyaSection = {
  type: string;
  title: string;
  content: string;
  blackboardNotes?: string[];
  visualHint?: string | null;
  formulaLatex?: string | null;
  exampleSteps?: Array<{
    stepNumber: number;
    expression: string;
    teacherComment: string;
    isCommonMistakePoint: boolean;
  }> | null;
  conceptCheck?: { question: string; hint: string; answer: string } | null;
}

const SECTION_STYLES: Record<string, { bg: string; border: string; label: string; labelColor: string }> = {
  hook:           { bg: 'bg-[#EEEDFE]',  border: 'border-indigo-200', label: 'Hook',            labelColor: 'text-[#534AB7]' },
  concept:        { bg: 'bg-white',       border: 'border-gray-200',   label: 'Concept',         labelColor: 'text-gray-600' },
  worked_example: { bg: 'bg-white',       border: 'border-indigo-100', label: 'Worked Example',  labelColor: 'text-[#534AB7]' },
  concept_check:  { bg: 'bg-[#EAF3DE]',  border: 'border-green-200',  label: 'Concept Check',   labelColor: 'text-[#1D9E75]' },
  common_mistake: { bg: 'bg-[#FCEBEB]',  border: 'border-red-200',    label: 'Common Mistake',  labelColor: 'text-[#E24B4A]' },
  memory_aid:     { bg: 'bg-[#EAF3DE]',  border: 'border-green-200',  label: 'Memory Aid',      labelColor: 'text-[#1D9E75]' },
  summary:        { bg: 'bg-[#FAEEDA]',  border: 'border-amber-200',  label: 'Summary',         labelColor: 'text-[#BA7517]' },
}

function ConceptCheckCard({ check }: { check: NonNullable<VidyaSection['conceptCheck']> }) {
  const [showHint, setShowHint] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  return (
    <div className="mt-3 rounded-lg border border-green-200 bg-white p-3 space-y-2">
      <p className="text-sm font-medium text-gray-800">{check.question}</p>
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setShowHint((v) => !v)}
          className="min-h-[44px] min-w-[44px] px-3 text-xs font-medium rounded-md border border-green-300 text-[#1D9E75] hover:bg-[#EAF3DE] transition-colors"
        >
          {showHint ? 'Hide hint' : 'Show hint'}
        </button>
        <button
          type="button"
          onClick={() => setShowAnswer((v) => !v)}
          className="min-h-[44px] min-w-[44px] px-3 text-xs font-medium rounded-md border border-indigo-300 text-[#534AB7] hover:bg-[#EEEDFE] transition-colors"
        >
          {showAnswer ? 'Hide answer' : 'Reveal answer'}
        </button>
      </div>
      {showHint && (
        <p className="text-xs text-gray-600 bg-green-50 rounded px-3 py-2">
          <span className="font-semibold">Hint: </span>{check.hint}
        </p>
      )}
      {showAnswer && (
        <p className="text-xs text-gray-700 bg-indigo-50 rounded px-3 py-2">
          <span className="font-semibold">Answer: </span>{check.answer}
        </p>
      )}
    </div>
  )
}

function VidyaSectionCard({ sec }: { sec: VidyaSection }) {
  const style = SECTION_STYLES[sec.type] ?? SECTION_STYLES.concept
  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-bold uppercase tracking-wide ${style.labelColor}`}>
          {style.label}
        </span>
      </div>
      <h3 className="text-base font-bold text-gray-900">{sec.title}</h3>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{sec.content}</p>

      {sec.formulaLatex && (
        <div className="rounded-md bg-gray-900 px-4 py-2 overflow-x-auto">
          <code className="text-sm text-green-300 font-mono">{sec.formulaLatex}</code>
        </div>
      )}

      {sec.visualHint && (
        <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
          <p className="text-xs text-gray-500 italic">{sec.visualHint}</p>
        </div>
      )}

      {Array.isArray(sec.exampleSteps) && sec.exampleSteps.length > 0 && (
        <div className="space-y-2">
          {sec.exampleSteps.map((step) => (
            <div
              key={step.stepNumber}
              className={`rounded-md border px-3 py-2 text-sm ${step.isCommonMistakePoint ? 'border-red-200 bg-[#FCEBEB]' : 'border-gray-100 bg-white'}`}
            >
              <div className="flex items-start gap-2">
                <span className="shrink-0 w-5 h-5 rounded-full bg-[#534AB7] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {step.stepNumber}
                </span>
                <div className="space-y-1">
                  <code className="block font-mono text-xs text-gray-800">{step.expression}</code>
                  {step.teacherComment && (
                    <p className="text-xs text-gray-500 italic">{step.teacherComment}</p>
                  )}
                  {step.isCommonMistakePoint && (
                    <p className="text-xs font-semibold text-[#E24B4A]">Watch out -- common mistake point!</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {sec.conceptCheck && <ConceptCheckCard check={sec.conceptCheck} />}

      {Array.isArray(sec.blackboardNotes) && sec.blackboardNotes.length > 0 && (
        <div className="rounded-md bg-gray-900 px-3 py-2">
          <p className="text-xs font-semibold text-gray-400 mb-1">Blackboard</p>
          <ul className="space-y-0.5">
            {sec.blackboardNotes.map((note, i) => (
              <li key={i} className="text-xs font-mono text-yellow-200">{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function VidyaNoteRenderer({ obj }: { obj: Record<string, unknown> }) {
  const sections = obj.sections as VidyaSection[]
  const keyConcepts = obj.keyConcepts as Array<{ term: string; definition: string; formula: string | null }> | undefined
  const examTips = obj.examTips as string[] | undefined
  const bridgeToNext = obj.bridgeToNext as string | undefined
  const metadata = obj.metadata as Record<string, unknown> | undefined

  return (
    <article className="space-y-4">
      {metadata && (
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          {metadata.board && <span className="rounded-full bg-gray-100 px-2 py-0.5">{String(metadata.board)}</span>}
          {metadata.grade && <span className="rounded-full bg-gray-100 px-2 py-0.5">Grade {String(metadata.grade)}</span>}
          {metadata.difficultyLevel && <span className="rounded-full bg-gray-100 px-2 py-0.5 capitalize">{String(metadata.difficultyLevel)}</span>}
          {metadata.estimatedReadingMinutes && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5">{String(metadata.estimatedReadingMinutes)} min read</span>
          )}
        </div>
      )}

      {sections.map((sec, i) => <VidyaSectionCard key={i} sec={sec} />)}

      {Array.isArray(keyConcepts) && keyConcepts.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-[#EEEDFE] p-4 space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#534AB7]">Key Concepts</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {keyConcepts.map((kc, i) => (
              <div key={i} className="rounded-lg bg-white border border-indigo-100 p-3">
                <p className="text-sm font-bold text-gray-900">{kc.term}</p>
                <p className="text-xs text-gray-600 mt-1">{kc.definition}</p>
                {kc.formula && (
                  <code className="block text-xs font-mono text-[#534AB7] mt-1">{kc.formula}</code>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {Array.isArray(examTips) && examTips.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-[#FAEEDA] p-4 space-y-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-[#BA7517]">Exam Tips</h3>
          <ul className="space-y-1">
            {examTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-900">
                <span className="shrink-0 text-[#BA7517] font-bold mt-0.5">{i + 1}.</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {bridgeToNext && (
        <div className="rounded-xl border border-indigo-200 bg-[#EEEDFE] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[#534AB7] mb-1">Up Next</p>
          <p className="text-sm text-indigo-800">{bridgeToNext}</p>
        </div>
      )}
    </article>
  )
}

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

    // VidyaNotesSchema: sections array where each item has a `type` field
    if (Array.isArray(obj.sections) && obj.sections.length > 0 && typeof (obj.sections[0] as any)?.type === 'string') {
      return <VidyaNoteRenderer obj={obj} />
    }

    // Legacy sections format: heading/content/points
    if (Array.isArray(obj.sections)) {
      return (
        <article className="space-y-6 rounded-lg border bg-white p-6">
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

          {obj.objectives && Array.isArray(obj.objectives) && obj.objectives.length > 0 && (
            <div className="rounded-lg bg-[#EEEDFE] border border-indigo-100 p-4 mt-4">
              <h3 className="text-sm font-semibold text-[#534AB7] mb-2">Learning Objectives</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-indigo-800">
                {(obj.objectives as string[]).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}

          {obj.keyPoints && Array.isArray(obj.keyPoints) && (
            <div className="rounded-lg bg-[#EEEDFE] border border-indigo-100 p-4">
              <h3 className="text-sm font-semibold text-[#534AB7] mb-2">Key Points</h3>
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

    // Flat NoteSchema format (title/concept/explanation/example/keyPoints/commonMistakes)
    if (typeof obj.explanation === 'string' || typeof obj.concept === 'string') {
      return (
        <article className="space-y-4 rounded-lg border bg-white p-6">
          {obj.concept && (
            <p className="text-sm text-gray-700 leading-relaxed">{String(obj.concept)}</p>
          )}
          {obj.explanation && (
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{String(obj.explanation)}</div>
          )}
          {obj.objectives && Array.isArray(obj.objectives) && obj.objectives.length > 0 && (
            <div className="rounded-lg bg-[#EEEDFE] border border-indigo-100 p-4 mt-2">
              <h3 className="text-sm font-semibold text-[#534AB7] mb-2">Learning Objectives</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-indigo-800">
                {(obj.objectives as string[]).map((o, i) => (
                  <li key={i}>{o}</li>
                ))}
              </ul>
            </div>
          )}
          {obj.example && (
            <div className="rounded-md bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Examples</p>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{String(obj.example)}</div>
            </div>
          )}
          {Array.isArray(obj.keyPoints) && obj.keyPoints.length > 0 && (
            <div className="rounded-lg bg-[#EEEDFE] border border-indigo-100 p-4">
              <h3 className="text-sm font-semibold text-[#534AB7] mb-2">Key Points</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-indigo-800">
                {(obj.keyPoints as string[]).map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
          {Array.isArray(obj.commonMistakes) && obj.commonMistakes.length > 0 && (
            <div className="rounded-lg bg-[#FCEBEB] border border-red-100 p-4">
              <h3 className="text-sm font-semibold text-[#E24B4A] mb-2">Common Mistakes</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-900">
                {(obj.commonMistakes as string[]).map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}
        </article>
      )
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
