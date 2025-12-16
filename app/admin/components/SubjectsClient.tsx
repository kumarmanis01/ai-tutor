"use client"
import React, { useEffect, useState } from "react";

export default function SubjectsClient() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subjects")
      .then((res) => res.json())
      .then((data) => {
        setSubjects(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Subjects</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Name</th>
              <th className="border px-4 py-2">Slug</th>
              <th className="border px-4 py-2">Class</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="border px-4 py-2">{subject.name}</td>
                <td className="border px-4 py-2">{subject.slug}</td>
                <td className="border px-4 py-2">{subject.classId}</td>
                <td className="border px-4 py-2">Edit | Delete</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
