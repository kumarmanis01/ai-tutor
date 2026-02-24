import React from 'react';

export type ChapterSnapshot = {
  chapterId: string;
  name: string;
  order: number;
  topicCount: number;
  completedTopics: number;
  progress: number; // 0-100
};

export type SubjectSnapshot = {
  subjectId: string | number;
  name: string;
  topicCount?: number;
  completedTopics?: number;
  percentComplete?: number; // 0-100
  mastery?: 'weak' | 'improving' | 'strong' | string;
  chapters?: ChapterSnapshot[];
};

export interface LearningPathSnapshotProps {
  subjects: SubjectSnapshot[];
}

function masteryColor(mastery?: string) {
  switch (mastery) {
    case 'improving':
      return 'bg-blue-500';
    case 'strong':
      return 'bg-emerald-500';
    default:
      return 'bg-gray-400';
  }
}

export default function LearningPathSnapshot({ subjects }: LearningPathSnapshotProps) {
  const list = Array.isArray(subjects) ? subjects.slice(0, 4) : [];

  return (
    <section className="max-w-4xl mx-auto bg-white rounded-lg border p-6 mb-8" aria-labelledby="learning-path-heading">
      <div className="flex items-center justify-between">
        <h3 id="learning-path-heading" className="text-lg font-semibold">
          Learning Path
        </h3>
        <a href="#" className="text-sm text-indigo-600 hover:underline">
          View Curriculum
        </a>
      </div>

      <ul className="mt-3 space-y-4" role="list">
        {list.map((s) => {
          const pct = Math.max(0, Math.min(100, Math.round(s.percentComplete || 0)));
          const chapters = Array.isArray(s.chapters) ? s.chapters : [];

          return (
            <li key={s.subjectId}>
              {/* Subject row */}
              <div className="flex items-center gap-3">
                <div className="w-1/3 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{s.name}</div>
                  {typeof s.topicCount === 'number' && (
                    <div className="text-xs text-gray-500">
                      {s.completedTopics ?? 0} / {s.topicCount} topics
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div
                    className="w-full h-2 bg-gray-200 rounded overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={pct}
                    aria-label={`${s.name} ${pct}% complete`}
                  >
                    <div className="h-full bg-indigo-600" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{pct}%</div>
                </div>

                <div className="w-8 flex justify-end">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${masteryColor(s.mastery)}`}
                    role="img"
                    aria-label={`mastery ${s.mastery ?? 'weak'}`}
                  />
                </div>
              </div>

              {/* Chapter rows — indented under subject */}
              {chapters.length > 0 && (
                <ul className="mt-2 ml-4 space-y-1 border-l border-gray-100 pl-3">
                  {chapters.map((ch) => (
                    <li key={ch.chapterId} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-600 truncate">{ch.name}</span>
                          <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
                            {ch.completedTopics}/{ch.topicCount}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-gray-100 rounded overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-indigo-400"
                            style={{ width: `${ch.progress}%` }}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}

        {list.length === 0 && (
          <li className="text-sm text-gray-500">No curriculum data available</li>
        )}
      </ul>
    </section>
  );
}
