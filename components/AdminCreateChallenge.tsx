'use client';
import React, { useState } from 'react';

type FormState = {
  key: string;
  title: string;
  description: string;
  startAt: string;
  endAt: string;
  rewardPoints: number;
  rewardBadgeId: string;
};

export default function AdminCreateChallenge() {
  const [form, setForm] = useState<FormState>({
    key: '',
    title: '',
    description: '',
    startAt: '',
    endAt: '',
    rewardPoints: 0,
    rewardBadgeId: '',
  });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const update = (k: keyof FormState, v: string | number) => setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    setMsg(null);

    try {
      const res = await fetch('/api/admin/challenges/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: form.key.trim(),
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          startAt: form.startAt,
          endAt: form.endAt,
          rewardPoints: form.rewardPoints || 0,
          rewardBadgeId: form.rewardBadgeId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data?.error ?? 'Failed');
      } else {
        setMsg('Challenge created');
        // clear minimal fields
        setForm((s) => ({ ...s, key: '', title: '', description: '' }));
      }
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4 bg-white dark:bg-gray-800 rounded shadow">
      <h3 className="text-lg font-semibold">Create Challenge</h3>

      <div>
        <label className="block text-sm">Key (unique)</label>
        <input
          className="w-full"
          value={form.key}
          onChange={(e) => update('key', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm">Title</label>
        <input
          className="w-full"
          value={form.title}
          onChange={(e) => update('title', e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm">Description</label>
        <textarea
          className="w-full"
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm">Start (ISO)</label>
          <input
            className="w-full"
            value={form.startAt}
            onChange={(e) => update('startAt', e.target.value)}
            placeholder="2025-11-01T00:00:00Z"
          />
        </div>
        <div>
          <label className="block text-sm">End (ISO)</label>
          <input
            className="w-full"
            value={form.endAt}
            onChange={(e) => update('endAt', e.target.value)}
            placeholder="2025-11-08T00:00:00Z"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm">Reward Points</label>
          <input
            type="number"
            className="w-full"
            value={form.rewardPoints}
            onChange={(e) => update('rewardPoints', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-sm">Reward Badge ID (optional)</label>
          <input
            className="w-full"
            value={form.rewardBadgeId}
            onChange={(e) => update('rewardBadgeId', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1 rounded bg-indigo-600 text-white"
        >
          {loading ? 'Creating...' : 'Create'}
        </button>
        {msg && <span className="text-sm text-green-600">{msg}</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </form>
  );
}
