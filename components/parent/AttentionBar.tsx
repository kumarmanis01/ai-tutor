import React from 'react'
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar } from 'recharts'

type AttentionBySubject = { subject: string; count: number }

export default function AttentionBar({ items }: { items: AttentionBySubject[] }) {
  const data = items.map((i) => ({ subject: i.subject, count: i.count }))
  if (data.length === 0) return <div className="text-sm text-gray-500 dark:text-gray-400">No attention flags right now.</div>

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="subject" tick={{ fontSize: 12 }} interval={0} angle={-10} height={42} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" name="Topics needing support" fill="#f59e0b" radius={[8, 8, 0, 0]} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
