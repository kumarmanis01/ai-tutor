'use client';
import React, { useEffect, useState } from 'react';

interface SubjectRow {
  id: string;
  name: string;
  slug: string;
  board: string;
  grade: number;
}

export default function SubjectsClient() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/hierarchy?include=subjects')
      .then((res) => res.json())
      .then((boards: any[]) => {
        const rows: SubjectRow[] = [];
        for (const board of boards) {
          for (const cls of board.classes ?? []) {
            for (const sub of cls.subjects ?? []) {
              rows.push({
                id: sub.id,
                name: sub.name,
                slug: sub.slug,
                board: board.name,
                grade: cls.grade,
              });
            }
          }
        }
        rows.sort(
          (a, b) =>
            a.board.localeCompare(b.board) || a.grade - b.grade || a.name.localeCompare(b.name)
        );
        setSubjects(rows);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 animate-pulse space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-red-600">{"Couldn't load subjects -- tap to retry"}</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Subjects</h1>
      <p className="text-sm text-gray-500 mb-4">{subjects.length} active subjects</p>
      <table className="min-w-full border text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Slug</th>
            <th className="border px-4 py-2 text-left">Board</th>
            <th className="border px-4 py-2 text-left">Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjects.length === 0 && (
            <tr>
              <td colSpan={4} className="border px-4 py-4 text-center text-gray-400">
                No subjects found
              </td>
            </tr>
          )}
          {subjects.map((sub) => (
            <tr key={sub.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2 font-medium">{sub.name}</td>
              <td className="border px-4 py-2 text-gray-500 font-mono text-xs">{sub.slug}</td>
              <td className="border px-4 py-2">{sub.board}</td>
              <td className="border px-4 py-2">Grade {sub.grade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
