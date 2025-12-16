"use client"
import React, { useEffect, useState } from "react";

export default function ClassesClient() {
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/classes")
      .then((res) => res.json())
      .then((data) => {
        setClasses(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Grades / Classes</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Grade</th>
              <th className="border px-4 py-2">Slug</th>
              <th className="border px-4 py-2">Board</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls) => (
              <tr key={cls.id}>
                <td className="border px-4 py-2">{cls.grade}</td>
                <td className="border px-4 py-2">{cls.slug}</td>
                <td className="border px-4 py-2">{cls.boardId}</td>
                <td className="border px-4 py-2">Edit | Delete</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
