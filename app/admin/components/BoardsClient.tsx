'use client';
import React, { useEffect, useState } from 'react';

interface BoardRow {
  id: string;
  name: string;
  slug: string;
  isActive?: boolean;
}

export default function BoardsClient() {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchBoards = () => {
    setLoading(true);
    setError(false);
    fetch('/api/boards')
      .then((res) => {
        if (!res.ok) throw new Error('Failed');
        return res.json();
      })
      .then((data: BoardRow[]) => setBoards(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBoards();
  }, []);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-600">
        {"Couldn't load boards -- tap to retry"}
        <button className="ml-3 underline text-sm" onClick={fetchBoards}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Boards</h1>
      <p className="text-sm text-gray-500 mb-4">{boards.length} boards</p>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Slug</th>
            <th className="border px-4 py-2 text-left">Active</th>
          </tr>
        </thead>
        <tbody>
          {boards.length === 0 && (
            <tr>
              <td colSpan={3} className="border px-4 py-4 text-center text-gray-400">
                No boards found
              </td>
            </tr>
          )}
          {boards.map((board) => (
            <tr key={board.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2 font-medium">{board.name}</td>
              <td className="border px-4 py-2 text-gray-500 font-mono text-xs">{board.slug}</td>
              <td className="border px-4 py-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs ${board.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                >
                  {board.isActive !== false ? 'active' : 'inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
