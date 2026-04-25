import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

const PIE_COLORS: Record<string, string> = {
  beginner: '#ef4444',
  intermediate: '#f59e0b',
  advanced: '#3b82f6',
  expert: '#10b981',
};

type MasteryDistribution = {
  masteryLevel: string;
  count: number;
};

export default function MasteryPie({ distribution }: { distribution: MasteryDistribution[] }) {
  const data = distribution
    .filter((d) => d.count > 0)
    .map((d) => ({
      name: d.masteryLevel.charAt(0).toUpperCase() + d.masteryLevel.slice(1),
      value: d.count,
      level: d.masteryLevel,
    }));

  if (data.length === 0)
    return <div className="text-sm text-gray-500 dark:text-gray-400">No mastery data yet.</div>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell
                key={(entry as any).level}
                fill={PIE_COLORS[(entry as any).level] || '#94a3b8'}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
