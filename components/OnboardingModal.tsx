"use client";

import React, { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { useSession } from 'next-auth/react';
import useCurrentUser from '@/hooks/useCurrentUser';

export default function OnboardingModal() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [name, setName] = useState('');
  const [childClass, setChildClass] = useState('');
  const [board, setBoard] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      // If no signed-in user/email, nothing to do
      if (!session?.user?.email) {
        setLoadingProfile(false);
        return;
      }
      try {
        const res = await fetch('/api/user/profile');
        if (!res.ok) {
          setLoadingProfile(false);
          return;
        }
        const data = await res.json();
        setName(data.name || '');
        setPreferredLanguage(data.language || '');
        setChildClass(data.grade ?? '');
        setBoard(data.board ?? '');
        // If any critical field missing, open modal
        // Require name, language, grade and board for a complete student profile
        const missing = !data.name || !data.language || !data.grade || !data.board;
        setOpen(Boolean(missing));
      } catch (e) {
        logger.warn(`OnboardingModal: failed to load profile: ${String(e)}`, { className: 'OnboardingModal', methodName: 'load' });
      } finally {
        setLoadingProfile(false);
      }
    }
    if (status !== 'loading') load();
  }, [session, status]);

  const toggleSubject = (s: string) => {
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const { mutate } = useCurrentUser();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          class_grade: childClass || null,
          board: board || null,
          preferred_language: preferredLanguage || null,
          subjects: subjects.length ? subjects : undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j?.error || 'Failed to save profile');
        setSaving(false);
        return;
      }
      // Refresh profile cache so UI updates immediately
      try {
        await mutate();
      } catch (mErr) {
        // ignore mutate errors — fallback to full redirect
        logger.warn(`OnboardingModal: mutate failed: ${String(mErr)}`, { className: 'OnboardingModal', methodName: 'handleSave' });
      }
      setOpen(false);
      // Redirect to student home dashboard so user lands in the app after onboarding
      window.location.replace('/dashboard');
    } catch (err) {
      logger.error(`onboarding save error: ${String(err)}`, { className: 'OnboardingModal', methodName: 'handleSave' });
      setError('Network error');
      setSaving(false);
    }
  };

  if (loadingProfile) return null;
  if (!session) return null;

  return (
    <div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <form onSubmit={handleSave} className="relative bg-white rounded-lg shadow-lg p-6 w-full max-w-lg mx-4">
            <h2 className="text-lg font-semibold mb-2">Complete your profile</h2>
            <p className="text-sm text-muted-foreground mb-4">We need a few details to personalize learning.</p>
            <input className="w-full px-3 py-2 border rounded mb-3" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="mb-3">
              <label className="block text-sm mb-1">Class</label>
              <select value={childClass} onChange={(e) => setChildClass(e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="">Select class</option>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={String(i + 1)}>{String(i + 1)}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm mb-1">Board</label>
              <select value={board} onChange={(e) => setBoard(e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="">Select board</option>
                <option>CBSE</option>
                <option>ICSE</option>
                <option>State Board</option>
                <option>Other</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm mb-1">Preferred language</label>
              <select value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} className="w-full px-3 py-2 border rounded">
                <option value="">Choose language</option>
                <option value="en">English</option>
                <option value="hi">हिंदी</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-sm mb-1">Subjects (optional)</label>
              <div className="grid grid-cols-2 gap-2">
                {['Mathematics','Science','English','Hindi','Physics','Chemistry','Biology'].map((s) => (
                  <button type="button" key={s} onClick={() => toggleSubject(s)} className={`px-3 py-2 border rounded text-left ${subjects.includes(s) ? 'bg-primary/10 border-primary' : ''}`}>
                    {subjects.includes(s) ? '☑︎ ' : '◻︎ '} {s}
                  </button>
                ))}
              </div>
            </div>
            {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
            <div className="flex justify-end gap-3">
              <button type="button" className="px-4 py-2 border rounded" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-white rounded">{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
