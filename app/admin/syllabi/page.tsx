"use client";

import React, { useEffect, useState } from "react";

type SyllabusRecord = {
  id: string;
  title: string;
  version: string;
  status: string;
  json: any;
  createdAt: string;
};

export default function AdminSyllabiPage() {
  const [syllabi, setSyllabi] = useState<SyllabusRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/admin/syllabi')
      .then((r) => r.json())
      .then((data: SyllabusRecord[]) => {
        if (!mounted) return;
        setSyllabi(data || []);
        if (data && data.length > 0) setSelectedId(data[0].id);
      })
      .catch(() => setSyllabi([]))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const selected = syllabi.find((s) => s.id === selectedId) ?? null;

  return (
    <div style={{ padding: 20, fontFamily: 'Inter, system-ui, -apple-system' }}>
      <h1>Admin — Syllabi (Read-only)</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ width: 300 }}>
            <h3>Versions</h3>
            {syllabi.length === 0 ? (
              <p>No syllabi found.</p>
            ) : (
              <select
                style={{ width: '100%' }}
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {syllabi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} — {s.version} — {s.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div style={{ flex: 1 }}>
            <h3>JSON Preview</h3>
            {selected ? (
              <div>
                <div style={{ marginBottom: 8, color: '#666' }}>
                  <strong>Title:</strong> {selected.title} &nbsp; | &nbsp;
                  <strong>Version:</strong> {selected.version} &nbsp; | &nbsp;
                  <strong>Status:</strong> {selected.status}
                </div>
                <pre
                  style={{
                    background: '#0b1220',
                    color: '#e6eef8',
                    padding: 16,
                    borderRadius: 8,
                    overflowX: 'auto',
                    maxHeight: '70vh',
                  }}
                >
                  {JSON.stringify(selected.json, null, 2)}
                </pre>
              </div>
            ) : (
              <p>Select a syllabus version to preview its JSON.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
