"use client"
import React, { useEffect, useState } from "react";

export default function BoardsClient() {
  const [boards, setBoards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/boards")
      .then((res) => res.json())
      .then((data) => {
        setBoards(data);
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Boards</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Name</th>
              <th className="border px-4 py-2">Slug</th>
              <th className="border px-4 py-2">Active</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {boards.map((board) => (
              <tr key={board.id}>
                <td className="border px-4 py-2">{board.name}</td>
                <td className="border px-4 py-2">{board.slug}</td>
                <td className="border px-4 py-2">{board.isActive ? "Yes" : "No"}</td>
                <td className="border px-4 py-2">Edit | Delete</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
