'use client';
import React, { useState } from 'react';

/**
 * Simple client-side waitlist form (Phase-2 preserved)
 * Stores entries in localStorage; backend can be wired in Phase-3+.
 */
export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    try {
      const raw = localStorage.getItem('ai-tutor:waitlist') || '[]';
      const arr = JSON.parse(raw);
      arr.push({ email, ts: new Date().toISOString() });
      localStorage.setItem('ai-tutor:waitlist', JSON.stringify(arr));
      setOk(true);
      setEmail('');
    } catch {
      setOk(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <h3 className="font-semibold">Join the waitlist</h3>
      {ok ? (
        <div className="text-sm text-green-600">Thanks &mdash; we&apos;ll notify you.</div>
      ) : (
        <>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="border p-2 rounded w-full"
            required
          />
          <button type="submit" className="w-full p-2 bg-blue-600 text-white rounded">
            Join
          </button>
        </>
      )}
    </form>
  );
}
