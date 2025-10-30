'use client';
import { useEffect, useState } from 'react';

type UserRow = { id: string; name?: string | null; image?: string | null; points: number };

export default function Leaderboard() {
  const [rows, setRows] = useState<UserRow[]>([]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setRows(d.top || []));
  }, []);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg p-4 shadow">
      <h3 className="font-semibold mb-3 text-indigo-700 dark:text-yellow-200">Leaderboard</h3>
      <ol className="list-decimal pl-5">
        {rows.map((u, i) => (
          <li key={u.id} className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-sm">
                {i < 3 ? (i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉') : (u.name ?? 'U')[0]}
              </div>
              <div>
                <div className="font-medium text-sm">{u.name ?? 'Anonymous'}</div>
              </div>
            </div>
            <div className="font-bold text-sm">{u.points}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}
