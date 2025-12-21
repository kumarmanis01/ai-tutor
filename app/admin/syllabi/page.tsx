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
                <div style={{ marginBottom: 8, color: '#666', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div>
                    <strong>Title:</strong> {selected.title} &nbsp; | &nbsp;
                    <strong>Version:</strong> {selected.version}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span style={{ padding: '4px 8px', borderRadius: 6, background: selected.status === 'APPROVED' ? '#d1fae5' : '#f0f5ff', color: selected.status === 'APPROVED' ? '#065f46' : '#1e3a8a' }}>
                      {selected.status}
                    </span>
                  </div>
                  <div style={{ marginLeft: 'auto' }}>
                    <button
                      onClick={async () => {
                        if (!selected) return;
                        try {
                          const res = await fetch(`/api/admin/syllabus/${selected.id}/approve`, { method: 'POST' });
                          if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            alert(`Approve failed: ${err?.error ?? res.statusText}`);
                            return;
                          }
                          const updated = await res.json();
                          // Update local state with updated record
                          setSyllabi((prev) => prev.map(p => p.id === updated.id ? updated : p));
                        } catch (e) {
                          alert(String(e));
                        }
                      }}
                      disabled={selected.status === 'APPROVED'}
                      style={{ padding: '6px 10px', borderRadius: 6, cursor: selected.status === 'APPROVED' ? 'not-allowed' : 'pointer' }}
                    >
                      Approve
                    </button>
                  </div>
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
