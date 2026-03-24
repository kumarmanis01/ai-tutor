"use client";

import React, { useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then(r => r.json());

type AudienceType = 'all' | 'grade' | 'inactive';

interface AudienceFilter {
  type: AudienceType;
  grade?: number;
  days?: number;
}

export default function NotificationsPage() {
  const [audienceType, setAudienceType] = useState<AudienceType>('all');
  const [grade, setGrade] = useState<number>(6);
  const [inactiveDays, setInactiveDays] = useState<number>(7);
  const [notifType, setNotifType] = useState<'push' | 'email'>('push');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ queued: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const audience: AudienceFilter =
    audienceType === 'grade'
      ? { type: 'grade', grade }
      : audienceType === 'inactive'
      ? { type: 'inactive', days: inactiveDays }
      : { type: 'all' };

  const countKey = `/api/admin/notifications/audience-count?audience=${encodeURIComponent(JSON.stringify(audience))}`;
  const { data: countData } = useSWR(countKey, fetcher, { keepPreviousData: true });

  const handleSend = async () => {
    if (!confirm) { setConfirm(true); return; }
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience, type: notifType, title, body }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to send'); }
      else { setSent(data); setTitle(''); setBody(''); setConfirm(false); }
    } finally {
      setSending(false);
    }
  };

  const canSend = title.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Broadcast Notification</h1>

      {sent && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
          Notification queued for {sent.queued} user{sent.queued !== 1 ? 's' : ''}.
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Audience */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Audience</h2>
        <div className="flex gap-2 mb-3 flex-wrap">
          {(['all', 'grade', 'inactive'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setAudienceType(t); setConfirm(false); }}
              className={`px-3 py-1.5 rounded text-sm min-h-[36px] ${audienceType === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              {t === 'all' ? 'All students' : t === 'grade' ? 'By grade' : 'Inactive students'}
            </button>
          ))}
        </div>

        {audienceType === 'grade' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Grade</label>
            <select value={grade} onChange={e => { setGrade(Number(e.target.value)); setConfirm(false); }} className="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600">
              {[6, 7, 8, 9, 10, 11, 12].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        )}

        {audienceType === 'inactive' && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">No session in last</label>
            <select value={inactiveDays} onChange={e => { setInactiveDays(Number(e.target.value)); setConfirm(false); }} className="border rounded px-2 py-1 text-sm dark:bg-gray-800 dark:border-gray-600">
              {[3, 5, 7, 14, 30].map(d => <option key={d} value={d}>{d} days</option>)}
            </select>
          </div>
        )}

        <div className="mt-3 text-sm text-gray-500">
          {countData?.count !== undefined
            ? `This will reach ${countData.count} student${countData.count !== 1 ? 's' : ''}`
            : 'Loading audience size...'}
        </div>
      </section>

      {/* Type */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Delivery</h2>
        <div className="flex gap-2">
          {(['push', 'email'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setNotifType(t); setConfirm(false); }}
              className={`px-3 py-1.5 rounded text-sm min-h-[36px] ${notifType === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              {t === 'push' ? 'Push notification' : 'Email'}
            </button>
          ))}
        </div>
      </section>

      {/* Message */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Message</h2>
        <input
          value={title}
          onChange={e => { setTitle(e.target.value); setConfirm(false); }}
          placeholder="Title"
          className="w-full border rounded px-3 py-2 text-sm mb-3 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        />
        <textarea
          value={body}
          onChange={e => { setBody(e.target.value); setConfirm(false); }}
          placeholder="Message body"
          rows={4}
          className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
        />
      </section>

      {confirm && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Send to {countData?.count ?? '?'} users? Click Send again to confirm.
        </div>
      )}

      <button
        disabled={!canSend || sending}
        onClick={handleSend}
        className="px-6 py-2 bg-indigo-600 text-white rounded disabled:opacity-50 min-h-[44px] text-sm font-medium"
      >
        {sending ? 'Sending...' : confirm ? 'Confirm Send' : 'Send Notification'}
      </button>
    </div>
  );
}
