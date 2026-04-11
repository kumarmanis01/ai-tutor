import React from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'

type WeeklyPoint = {
  weekStart: string
  topicsCovered: number
  testsTaken: number
  averageScore: number
  totalMinutes: number
  sessionsCount: number
  subjectsActive: string[]
}

export default function WeeklyTrendChart({ weekly }: { weekly: WeeklyPoint[] }) {
  const data = [...weekly]
    .sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime())
    .map((w) => ({
      week: new Date(w.weekStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      minutes: w.totalMinutes,
      topics: w.topicsCovered,
      tests: w.testsTaken,
      score: Math.max(0, Math.min(100, Math.round(w.averageScore ?? 0))),
    }))

  if (data.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400">No weekly data yet.</div>
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 18, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="week" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Area yAxisId="left" type="monotone" dataKey="minutes" name="Study minutes" stroke="#6366f1" fill="#6366f1" fillOpacity={0.18} />
          <Bar yAxisId="left" dataKey="topics" name="Topics attempted" fill="#a78bfa" radius={[6, 6, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="score" name="Avg score" stroke="#10b981" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
