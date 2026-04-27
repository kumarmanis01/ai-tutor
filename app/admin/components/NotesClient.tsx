"use client"
import React, { useEffect, useState } from "react";

function ModerationActions({ note, refresh }: { note: any; refresh: () => void }) {
  const handleAction = async (action: string) => {
    const url = `/api/admin/notes/${note.id}/${action}`;
    const method = "POST";
    let body: any = undefined;
    if (action === "reject") {
      body = JSON.stringify({ reason: "Rejected by admin" });
    }
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
    refresh();
  };
  return (
    <div className="flex gap-2">
      <button className="text-green-600" onClick={() => handleAction("approve")}>Approve</button>
      <button className="text-red-600" onClick={() => handleAction("reject")}>Reject</button>
      <button className="text-blue-600" onClick={() => handleAction("regenerate")}>Regenerate</button>
      <button className="text-gray-600" onClick={() => handleAction("unpublish")}>Unpublish</button>
    </div>
  );
}

export default function NotesClient() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = () => {
    setLoading(true);
    fetch("/api/notes")
      .then((res) => res.json())
      .then((data) => {
        setNotes(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Notes</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Title</th>
              <th className="border px-4 py-2">Language</th>
              <th className="border px-4 py-2">Topic</th>
              <th className="border px-4 py-2">Status</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((note) => (
              <tr key={note.id}>
                <td className="border px-4 py-2">{note.title}</td>
                <td className="border px-4 py-2">{note.language}</td>
                <td className="border px-4 py-2">{note.topicId}</td>
                <td className="border px-4 py-2">{note.status}</td>
                <td className="border px-4 py-2">
                  <ModerationActions note={note} refresh={fetchNotes} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
