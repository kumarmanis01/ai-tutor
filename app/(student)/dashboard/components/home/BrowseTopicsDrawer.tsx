'use client';
/**
 * FILE OBJECTIVE:
 * - Gamified topic browser drawer for students to explore and choose topics.
 * - Shows mastery level, XP reward, and difficulty cues per topic.
 * - Slides up from bottom on mobile, appears as side panel on desktop.
 * - Follows mobile-first 360px target, min-h-[44px] on all interactive elements.
 *
 * EDIT LOG:
 * - 2026-05-03 | claude | created for gamify-topics-parent-alerts task
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

interface TopicItem {
  id: string;
  name: string;
  mastery: number;
  masteryLabel: string;
  masteryColor: 'green' | 'blue' | 'amber' | 'gray';
  practiceCount: number;
  xpReward: number;
  isStarted: boolean;
  isMastered: boolean;
}

interface ChapterItem {
  id: string;
  name: string;
  topics: TopicItem[];
}

interface SubjectItem {
  id: string;
  name: string;
  slug: string;
  chapters: ChapterItem[];
}

interface BrowseTopicsDrawerProps {
  open: boolean;
  onClose: () => void;
}

// ── Mastery color map ────────────────────────────────────────────────────────

const MASTERY_STYLES: Record<
  TopicItem['masteryColor'],
  { bg: string; text: string; bar: string; badge: string }
> = {
  green: {
    bg: 'bg-[#EAF3DE]',
    text: 'text-[#1D9E75]',
    bar: 'bg-[#1D9E75]',
    badge: 'bg-[#EAF3DE] text-[#1D9E75]',
  },
  blue: {
    bg: 'bg-[#EEEDFE]',
    text: 'text-[#534AB7]',
    bar: 'bg-[#534AB7]',
    badge: 'bg-[#EEEDFE] text-[#534AB7]',
  },
  amber: {
    bg: 'bg-[#FAEEDA]',
    text: 'text-[#BA7517]',
    bar: 'bg-[#BA7517]',
    badge: 'bg-[#FAEEDA] text-[#BA7517]',
  },
  gray: {
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    bar: 'bg-gray-300',
    badge: 'bg-gray-100 text-gray-500',
  },
};

const SUBJECT_EMOJIS: Record<string, string> = {
  mathematics: '📐',
  math: '📐',
  maths: '📐',
  physics: '⚡',
  chemistry: '🧪',
  biology: '🧬',
  science: '🔬',
  english: '📝',
  history: '🏛️',
  geography: '🌍',
  economics: '📊',
  'social science': '🌐',
  'political science': '⚖️',
  computer: '💻',
  hindi: '🇮🇳',
  sanskrit: '📜',
};

function subjectEmoji(name: string): string {
  const key = name.toLowerCase();
  for (const [k, v] of Object.entries(SUBJECT_EMOJIS)) {
    if (key.includes(k)) return v;
  }
  return '📚';
}

// ── Component ────────────────────────────────────────────────────────────────

export function BrowseTopicsDrawer({ open, onClose }: BrowseTopicsDrawerProps) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/student/topics/browse');
      if (!res.ok) throw new Error('Failed to load topics');
      const data = await res.json();
      setSubjects(data.subjects ?? []);
    } catch {
      setError("Couldn't load topics -- tap to retry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && subjects.length === 0 && !loading) {
      fetchTopics();
    }
  }, [open, subjects.length, loading, fetchTopics]);

  // Reset drill-down when drawer closes
  useEffect(() => {
    if (!open) {
      setSelectedSubject(null);
      setExpandedChapters(new Set());
    }
  }, [open]);

  const handleStartTopic = (topicId: string) => {
    onClose();
    router.push(`/session/${encodeURIComponent(topicId)}`);
  };

  const toggleChapter = (chapterId: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Browse topics"
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl
                   sm:top-0 sm:right-0 sm:left-auto sm:bottom-0 sm:w-[420px] sm:rounded-none sm:rounded-l-3xl
                   flex flex-col max-h-[92vh] sm:max-h-full"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          {selectedSubject ? (
            <button
              onClick={() => setSelectedSubject(null)}
              className="flex items-center gap-2 text-sm font-medium text-[#534AB7] min-h-[44px] min-w-[44px]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-foreground">Explore Topics</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Pick something exciting to study</p>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-xl"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <button
                onClick={fetchTopics}
                className="px-4 py-2 bg-[#534AB7] text-white text-sm font-medium rounded-xl min-h-[44px]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Subject list */}
          {!loading && !error && !selectedSubject && subjects.length > 0 && (
            <div className="space-y-3">
              {subjects.map((subject) => {
                const totalTopics = subject.chapters.reduce((n, c) => n + c.topics.length, 0);
                const masteredTopics = subject.chapters.reduce(
                  (n, c) => n + c.topics.filter((t) => t.isMastered).length,
                  0
                );
                const startedTopics = subject.chapters.reduce(
                  (n, c) => n + c.topics.filter((t) => t.isStarted && !t.isMastered).length,
                  0
                );
                const pct = totalTopics > 0 ? Math.round((masteredTopics / totalTopics) * 100) : 0;

                return (
                  <button
                    key={subject.id}
                    onClick={() => {
                      setSelectedSubject(subject);
                      // Auto-expand first chapter
                      const firstId = subject.chapters[0]?.id;
                      if (firstId) setExpandedChapters(new Set([firstId]));
                    }}
                    className="w-full text-left p-4 rounded-2xl border border-border hover:border-[#534AB7]/40 hover:bg-[#EEEDFE]/50 transition-all min-h-[80px] group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{subjectEmoji(subject.name)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-foreground">{subject.name}</span>
                          <svg
                            className="w-4 h-4 text-muted-foreground group-hover:text-[#534AB7] transition-colors"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M9 18l6-6-6-6" />
                          </svg>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <span>{masteredTopics}/{totalTopics} mastered</span>
                          {startedTopics > 0 && (
                            <span className="text-[#BA7517]">{startedTopics} in progress</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#1D9E75] rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && !selectedSubject && subjects.length === 0 && (
            <div className="text-center py-12">
              <span className="text-4xl">📚</span>
              <p className="text-sm text-muted-foreground mt-3">No topics available yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Check back soon!</p>
            </div>
          )}

          {/* Subject drill-down: chapters + topics */}
          {!loading && !error && selectedSubject && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">{subjectEmoji(selectedSubject.name)}</span>
                <h3 className="font-bold text-foreground text-base">{selectedSubject.name}</h3>
              </div>

              {selectedSubject.chapters.map((chapter) => {
                const expanded = expandedChapters.has(chapter.id);
                const chapterMastered = chapter.topics.filter((t) => t.isMastered).length;
                return (
                  <div key={chapter.id} className="rounded-2xl border border-border overflow-hidden">
                    <button
                      onClick={() => toggleChapter(chapter.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors min-h-[52px]"
                    >
                      <div className="text-left">
                        <span className="font-medium text-sm text-foreground">{chapter.name}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {chapterMastered}/{chapter.topics.length} topics mastered
                        </p>
                      </div>
                      <svg
                        className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {expanded && (
                      <div className="divide-y divide-border">
                        {chapter.topics.map((topic) => {
                          const styles = MASTERY_STYLES[topic.masteryColor];
                          return (
                            <div
                              key={topic.id}
                              className="px-4 py-3 flex items-center gap-3"
                            >
                              {/* Mastery bar */}
                              <div className="w-1 h-10 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                                <div
                                  className={`${styles.bar} rounded-full transition-all`}
                                  style={{ height: `${Math.max(5, Math.round(topic.mastery * 100))}%` }}
                                />
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{topic.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${styles.badge}`}>
                                    {topic.masteryLabel}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    +{topic.xpReward} XP
                                  </span>
                                </div>
                              </div>

                              <button
                                onClick={() => handleStartTopic(topic.id)}
                                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center
                                           bg-[#534AB7] hover:bg-[#4840a3] text-white rounded-xl px-3 text-sm font-medium
                                           transition-colors"
                                aria-label={`Start ${topic.name}`}
                              >
                                {topic.isMastered ? 'Review' : topic.isStarted ? 'Continue' : 'Start'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default BrowseTopicsDrawer;
