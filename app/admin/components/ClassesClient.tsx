"use client"
import React, { useEffect, useState } from "react";

interface ClassRow {
  id: string;
  grade: number;
  boardName: string;
  lifecycle?: string;
}

export default function ClassesClient() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/boards")
      .then(res => res.json())
      .then((boards: any[]) => {
        const rows: ClassRow[] = [];
        for (const board of boards) {
          for (const cls of board.classes ?? []) {
            rows.push({ id: cls.id, grade: cls.grade, boardName: board.name, lifecycle: cls.lifecycle });
          }
        }
        rows.sort((a, b) => a.boardName.localeCompare(b.boardName) || a.grade - b.grade);
        setClasses(rows);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-6 animate-pulse space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-8 bg-gray-200 rounded" />)}</div>;
  }

  if (error) {
    return <div className="p-6 text-red-600">{"Couldn't load class data -- tap to retry"}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Grades / Classes</h1>
      <p className="text-sm text-gray-500 mb-4">{classes.length} classes across all boards</p>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border px-4 py-2 text-left">Board</th>
            <th className="border px-4 py-2 text-left">Grade</th>
            <th className="border px-4 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {classes.length === 0 && (
            <tr><td colSpan={3} className="border px-4 py-4 text-center text-gray-400">No classes found</td></tr>
          )}
          {classes.map(cls => (
            <tr key={cls.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{cls.boardName}</td>
              <td className="border px-4 py-2">Grade {cls.grade}</td>
              <td className="border px-4 py-2">
                <span className={`px-2 py-0.5 rounded text-xs ${cls.lifecycle === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {cls.lifecycle || 'unknown'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
