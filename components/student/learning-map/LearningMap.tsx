/**
 * FILE OBJECTIVE:
 * - Main S2.1 learning map UI: top summary, searchable header, horizontal chapter path, and bottom chapter info panel.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/student/learning-map/LearningMap.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created S2.1 learning map UI
 * - 2026-04-25T01:45:00Z | copilot | routed premium-locked nodes to freemium wall and added completed-chapter practice entry
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LearningMapNode, LearningMapPayload } from '@/hooks/useLearningMap';
import FreemiumWallModal from '@/components/student/practice/FreemiumWallModal';
import ChapterNode from './ChapterNode';
import ChapterInfo from './ChapterInfo';

type LearningMapProps = {
  studentId: string;
  data: LearningMapPayload;
  isOfflineCache: boolean;
  onRefresh: () => Promise<void>;
};

export function LearningMap({ studentId, data, isOfflineCache, onRefresh }: LearningMapProps) {
  const router = useRouter();
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(data.currentChapter?.chapterId ?? null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [premiumTopicId, setPremiumTopicId] = useState<string | null>(null);

  const selectedChapter = useMemo(() => {
    if (!selectedChapterId) return data.currentChapter;
    return data.chapters.find((node) => node.chapterId === selectedChapterId) ?? data.currentChapter;
  }, [data.chapters, data.currentChapter, selectedChapterId]);

  const filteredChapters = useMemo(() => {
    const value = search.trim().toLowerCase();
    if (!value) return data.chapters;
    return data.chapters.filter(
      (node) =>
        node.chapterName.toLowerCase().includes(value) || node.subjectName.toLowerCase().includes(value)
    );
  }, [data.chapters, search]);

  function handleNodeClick(node: LearningMapNode) {
    setSelectedChapterId(node.chapterId);

    if (node.state === 'premium-locked') {
      setPremiumTopicId(node.previewTopicId);
      return;
    }

    if (node.state === 'locked') {
      setToast(node.tooltip ?? 'This chapter is locked.');
      window.setTimeout(() => setToast(null), 2200);
      return;
    }

    if (node.previewTopicId) {
      router.push(`/student/learning-map/topic/${encodeURIComponent(node.previewTopicId)}`);
    }
  }

  function handlePracticeClick(node: LearningMapNode) {
    if (!node.previewTopicId) return;
    router.push(`/student/learning-map/topic/${encodeURIComponent(node.previewTopicId)}/practice`);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6">
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Learning Map</h1>
            <p className="text-sm text-gray-600">Follow your chapter path and unlock the next milestone.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            className="min-h-[44px] rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="min-h-[44px] rounded-xl bg-[#EEEDFE] px-3 py-2 text-left"
            aria-label="Study buddy greeting"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[#534AB7]">Study Buddy</p>
            <p className="mt-1 text-sm font-medium text-[#3C3489]">Hi! Let us unlock your next chapter.</p>
          </button>
          <div className="rounded-xl bg-[#EAF3DE] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1D9E75]">XP</p>
            <p className="mt-1 text-lg font-bold text-[#1D9E75]">{data.topBar.xp}</p>
          </div>
          <div className="rounded-xl bg-[#FAEEDA] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#BA7517]">Streak</p>
            <p className="mt-1 text-lg font-bold text-[#BA7517]">🔥 {data.topBar.streak}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chapter or subject"
            className="min-h-[44px] flex-1 rounded-xl border border-gray-300 px-3 text-sm text-gray-900 focus:border-[#534AB7] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="min-h-[44px] rounded-xl border border-[#534AB7] px-4 text-sm font-semibold text-[#534AB7] hover:bg-[#EEEDFE]"
          >
            Back to Dashboard
          </button>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Last synced: {new Date(data.lastSyncedAt).toLocaleString('en-IN')} {isOfflineCache ? '• Offline cache' : ''}
        </p>
      </div>

      <section className="mt-5">
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max items-stretch gap-4">
            {filteredChapters.map((node) => (
              <ChapterNode key={node.chapterId} node={node} onClick={handleNodeClick} onPractice={handlePracticeClick} />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5">
        <ChapterInfo chapter={selectedChapter} />
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-xs font-medium text-white">
          {toast}
        </div>
      )}

      {premiumTopicId && (
        <FreemiumWallModal
          studentId={studentId}
          topicId={premiumTopicId}
          featureType="chapter_quiz"
          onClose={() => setPremiumTopicId(null)}
        />
      )}
    </div>
  );
}

export default LearningMap;
