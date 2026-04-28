'use client';

/**
 * ExploreMap -- S0.3 curriculum map in locked/explore state.
 *
 * Shows 3 glowing "Free Preview" sample topics + a set of visually locked
 * placeholder topic cards. Tapping a free topic opens SampleLessonViewer.
 * Tapping a locked topic opens LockedFeatureModal.
 *
 * The free topics come from GET /api/v1/students/explore-content (already fetched
 * by the parent ExploreModeClient and passed in as `sampleTopics`).
 * Locked placeholders are fabricated from a small static subject/chapter pool
 * so the map feels curriculum-rich without requiring extra DB queries.
 */

import { useRef, useState } from 'react';
import LockedFeatureModal from './LockedFeatureModal';
import SampleLessonViewer from './SampleLessonViewer';

interface SampleTopic {
  id: string;
  name: string;
  sampleNote: string | null;
}

interface Props {
  sampleTopics: SampleTopic[];
  grade: number;
  onSendReminder: () => void;
  reminderBusy?: boolean;
}

const LOCKED_TOPIC_NAMES = [
  'Photosynthesis and Plant Nutrition',
  'The Indian Constitution',
  'Linear Equations in One Variable',
  'Force and Laws of Motion',
  'Cell Structure and Functions',
  'Resources and Development',
  'Rational Numbers',
  'Sound and Wave Motion',
  'Democratic Politics',
  'Polynomials',
  'Atoms and Molecules',
  'Climate and Vegetation',
];

export default function ExploreMap({ sampleTopics, grade, onSendReminder, reminderBusy }: Props) {
  const [activeLocked, setActiveLocked] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<SampleTopic | null>(null);
  const sampleRef = useRef<HTMLDivElement | null>(null);

  function scrollToSamples() {
    sampleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="px-4 mt-6">
      {/* Section header */}
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
        Your Curriculum Map
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Grade {grade} curriculum -- 3 topics unlocked for preview
      </p>

      {/* Free sample topics -- glowing */}
      <div ref={sampleRef} className="flex flex-col gap-3 mb-4">
        {sampleTopics.map((topic) => (
          <button
            key={topic.id}
            type="button"
            onClick={() => setActiveLesson(topic)}
            className={[
              'w-full text-left rounded-2xl border-2 border-[#534AB7]/40 bg-[#EEEDFE] dark:bg-[#534AB7]/10 p-4',
              'ring-2 ring-[#534AB7]/20 animate-pulse',
              'hover:border-[#534AB7] hover:ring-[#534AB7]/30 transition-all min-h-[72px]',
            ].join(' ')}
            aria-label={`Open free preview: ${topic.name}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#534AB7] dark:text-indigo-300 leading-snug">
                {topic.name}
              </span>
              <span className="shrink-0 text-xs bg-[#534AB7] text-white px-2 py-0.5 rounded-full whitespace-nowrap">
                Free Preview
              </span>
            </div>
            {topic.sampleNote && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                {topic.sampleNote}
              </p>
            )}
          </button>
        ))}
      </div>

      {/* Locked topics */}
      <div className="flex flex-col gap-2">
        {LOCKED_TOPIC_NAMES.slice(0, grade <= 8 ? 8 : 6).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setActiveLocked(name)}
            className="w-full text-left rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 min-h-[52px] flex items-center gap-3 hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
            aria-label={`Locked topic: ${name}`}
          >
            <span className="text-base" aria-hidden>
              🔒
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 leading-snug">{name}</span>
          </button>
        ))}
      </div>

      {/* Locked topic modal */}
      {activeLocked && (
        <LockedFeatureModal
          title="Topic Locked"
          body={`"${activeLocked}" unlocks when your parent approves. Explore our 3 free sample lessons in the meantime!`}
          onSendReminder={() => {
            setActiveLocked(null);
            onSendReminder();
          }}
          onViewSamples={() => {
            setActiveLocked(null);
            scrollToSamples();
          }}
          onClose={() => setActiveLocked(null)}
          reminderBusy={reminderBusy}
        />
      )}

      {/* Sample lesson full-screen viewer */}
      {activeLesson && (
        <SampleLessonViewer
          topicId={activeLesson.id}
          topicName={activeLesson.name}
          content={activeLesson.sampleNote}
          onClose={() => setActiveLesson(null)}
          onSendReminder={onSendReminder}
        />
      )}
    </div>
  );
}
