import React from 'react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';

type SubjectSummary = {
  subject: string;
  coveragePercent: number;
  averageMastery: number;
};

export default function SubjectRadar({ subjects }: { subjects: SubjectSummary[] }) {
  const data = subjects.map((s) => ({
    subject: s.subject,
    coverage: Math.max(0, Math.min(100, Math.round(s.coveragePercent ?? 0))),
    mastery: Math.max(0, Math.min(100, Math.round((s.averageMastery / 4) * 100))),
  }));

  if (data.length === 0)
    return <div className="text-sm text-gray-500 dark:text-gray-400">No subject progress yet.</div>;

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Radar
            name="Coverage %"
            dataKey="coverage"
            stroke="#6366f1"
            fill="#6366f1"
            fillOpacity={0.16}
          />
          <Radar
            name="Mastery %"
            dataKey="mastery"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.1}
          />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
