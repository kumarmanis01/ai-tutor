import React from 'react';

export type SubjectSnapshot = {
  subjectId: string | number;
  name: string;
  percentComplete?: number; // 0-100
  mastery?: 'weak' | 'improving' | 'strong' | string;
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

      <ul className="mt-3 space-y-3" role="list">
        {list.map((s) => {
          const pct = Math.max(0, Math.min(100, Math.round(s.percentComplete || 0)));
          return (
            <li key={s.subjectId} className="flex items-center gap-3">
              <div className="w-1/3 min-w-0">
                <div className="text-sm text-gray-700 truncate">{s.name}</div>
              </div>

              <div className="flex-1">
                <div className="w-full h-2 bg-gray-200 rounded overflow-hidden" aria-hidden>
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
            </li>
          );
        })}

        {list.length === 0 ? (
          <li className="text-sm text-gray-500">No subjects available</li>
        ) : null}
      </ul>
    </section>
  );
}
