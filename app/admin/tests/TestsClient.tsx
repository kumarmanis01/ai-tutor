"use client";

import { useEffect, useState } from "react";

function ModerationActions({ test, refresh }: { test: any; refresh: () => void }) {
  const handleAction = async (action: string) => {
    const url = `/api/admin/tests/${test.id}/${action}`;
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

export default function TestsClient() {
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTests = () => {
    setLoading(true);
    fetch("/api/tests")
      .then((res) => res.json())
      .then((data) => {
        setTests(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTests();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Tests</h1>
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th className="border px-4 py-2">Title</th>
              <th className="border px-4 py-2">Difficulty</th>
              <th className="border px-4 py-2">Language</th>
              <th className="border px-4 py-2">Topic</th>
              <th className="border px-4 py-2">Status</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tests.map((test) => (
              <tr key={test.id}>
                <td className="border px-4 py-2">{test.title}</td>
                <td className="border px-4 py-2">{test.difficulty}</td>
                <td className="border px-4 py-2">{test.language}</td>
                <td className="border px-4 py-2">{test.topicId}</td>
                <td className="border px-4 py-2">{test.status}</td>
                <td className="border px-4 py-2">
                  <ModerationActions test={test} refresh={fetchTests} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
