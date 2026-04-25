'use client';
import { useState, useEffect } from 'react';

type Turn = {
  id: string;
  callType: string;
  tag: string | null;
  stage: string | null;
  qualityFlag: string | null;
  createdAt: string;
};

type SessionRow = {
  id: string;
  studentId: string;
  startedAt: string;
  completedAt: string | null;
  turnCount: number;
  turns: Turn[];
};

export default function SessionsPage() {
  const [data, setData] = useState<{
    sessions: SessionRow[];
    date: string;
    totalYesterday: number;
  } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flagState, setFlagState] = useState<Record<string, { flag: string; note: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/sessions/sample')
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  async function submitFlag(sessionId: string, turnId: string) {
    const state = flagState[turnId];
    if (!state?.flag) return;
    setSubmitting(turnId);
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnId, flag: state.flag, note: state.note }),
      });
      if (res.ok) {
        setToast(`Flagged turn ${turnId.slice(0, 8)} as ${state.flag}`);
        setTimeout(() => setToast(null), 3000);
      }
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) return <p className="p-6 text-gray-500">Loading sessions...</p>;
  if (error) return <p className="p-6 text-red-600">Error: {error}</p>;

  return (
    <div>
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow z-50 text-sm">
          {toast}
        </div>
      )}
      <h1 className="text-2xl font-bold mb-2">Session Quality Review</h1>
      <p className="text-sm text-gray-500 mb-6">
        Date: {data?.date} -- {data?.totalYesterday ?? 0} total sessions yesterday
      </p>
      {!data?.sessions?.length && <p className="text-gray-400">No sessions found.</p>}
      <div className="space-y-4">
        {data?.sessions.map((s) => {
          const durationMin = s.completedAt
            ? Math.round(
                (new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()) / 60000
              )
            : null;
          return (
            <div key={s.id} className="border border-gray-200 rounded-lg bg-white">
              <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
              >
                <div className="text-sm">
                  <span className="font-mono text-xs text-gray-400">{s.id.slice(0, 12)}...</span>
                  <span className="ml-3 text-gray-600">Student: {s.studentId.slice(0, 8)}...</span>
                  {durationMin !== null && (
                    <span className="ml-3 text-gray-500">{durationMin}min</span>
                  )}
                  <span className="ml-3 text-gray-500">{s.turnCount} turns</span>
                </div>
                <span className="text-gray-400 text-xs">{expandedId === s.id ? '▲' : '▼'}</span>
              </div>
              {expandedId === s.id && (
                <div className="px-4 pb-4 border-t border-gray-100">
                  <table className="w-full text-xs mt-3">
                    <thead>
                      <tr className="text-left text-gray-400 border-b">
                        <th className="pb-1 pr-3">Turn ID</th>
                        <th className="pb-1 pr-3">Stage</th>
                        <th className="pb-1 pr-3">Current Flag</th>
                        <th className="pb-1 pr-3">Flag</th>
                        <th className="pb-1 pr-3">Note</th>
                        <th className="pb-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.turns.map((t) => (
                        <tr key={t.id} className="border-b border-gray-50">
                          <td className="py-1 pr-3 font-mono">{t.id.slice(0, 10)}...</td>
                          <td className="py-1 pr-3">{t.stage ?? t.callType}</td>
                          <td className="py-1 pr-3 text-amber-600">{t.qualityFlag ?? '--'}</td>
                          <td className="py-1 pr-3">
                            <select
                              value={flagState[t.id]?.flag ?? ''}
                              onChange={(e) =>
                                setFlagState((prev) => ({
                                  ...prev,
                                  [t.id]: { flag: e.target.value, note: prev[t.id]?.note ?? '' },
                                }))
                              }
                              className="border border-gray-200 rounded text-xs px-1 py-0.5"
                            >
                              <option value="">-- select --</option>
                              <option value="HALLUCINATION">HALLUCINATION</option>
                              <option value="INCORRECT_EXPLANATION">INCORRECT_EXPLANATION</option>
                              <option value="POOR_PEDAGOGY">POOR_PEDAGOGY</option>
                              <option value="OFF_TOPIC">OFF_TOPIC</option>
                              <option value="DIRECT_ANSWER_GIVEN">DIRECT_ANSWER_GIVEN</option>
                              <option value="SAFETY_CONCERN">SAFETY_CONCERN</option>
                            </select>
                          </td>
                          <td className="py-1 pr-3">
                            <input
                              type="text"
                              placeholder="note"
                              value={flagState[t.id]?.note ?? ''}
                              onChange={(e) =>
                                setFlagState((prev) => ({
                                  ...prev,
                                  [t.id]: { flag: prev[t.id]?.flag ?? '', note: e.target.value },
                                }))
                              }
                              className="border border-gray-200 rounded text-xs px-1 py-0.5 w-28"
                            />
                          </td>
                          <td className="py-1">
                            <button
                              type="button"
                              disabled={!flagState[t.id]?.flag || submitting === t.id}
                              onClick={() => submitFlag(s.id, t.id)}
                              className="px-2 py-0.5 bg-indigo-600 text-white rounded text-xs disabled:opacity-40"
                            >
                              Submit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
