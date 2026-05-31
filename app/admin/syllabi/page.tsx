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
    <div className="p-5 font-[Inter,system-ui,-apple-system]">
      <h1>Admin -- Syllabi (Read-only)</h1>
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="flex gap-5">
          <div className="w-[300px]">
            <h3>Versions</h3>
            {syllabi.length === 0 ? (
              <p>No syllabi found.</p>
            ) : (
              <select
                className="w-full"
                value={selectedId ?? ''}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {syllabi.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title} -- {s.version} -- {s.status}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex-1">
            <h3>JSON Preview</h3>
            {selected ? (
              <div>
                <div className="mb-2 text-gray-600 flex items-center gap-3">
                  <div>
                    <strong>Title:</strong> {selected.title} &nbsp; | &nbsp;
                    <strong>Version:</strong> {selected.version}
                  </div>
                  <div>
                    <strong>Status:</strong>{' '}
                    <span className={[
                      'px-2 py-1 rounded-[6px] text-sm',
                      selected.status === 'APPROVED'
                        ? 'bg-[#d1fae5] text-[#065f46]'
                        : 'bg-[#f0f5ff] text-[#1e3a8a]',
                    ].join(' ')}>
                      {selected.status}
                    </span>
                  </div>
                  <div className="ml-auto">
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
                          setSyllabi((prev) => prev.map(p => p.id === updated.id ? updated : p));
                        } catch (e) {
                          alert(String(e));
                        }
                      }}
                      disabled={selected.status === 'APPROVED'}
                      className={['px-[10px] py-[6px] rounded-[6px]', selected.status === 'APPROVED' ? 'cursor-not-allowed' : 'cursor-pointer'].join(' ')}
                    >
                      Approve
                    </button>
                  </div>
                </div>
                <pre className="bg-[#0b1220] text-[#e6eef8] p-4 rounded-lg overflow-x-auto max-h-[70vh]">
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
