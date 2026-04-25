/**
 * FILE OBJECTIVE:
 * - Small client component for capturing 14-day trial signups (parent name, phone, class).
 * - Posts to `/api/trial` and shows success / error feedback.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/TrialSignup.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - .github/copilot-instructions.md
 * - /docs/COPILOT_GUARDRAILS.md
 *
 * EDIT LOG:
 * - 2026-04-19T00:00:00Z | copilot | fix(lint): prefix unused catch param in handleSubmit
 * - 2026-04-15T00:00:00Z | copilot-planner | created trial signup UI component
 * - 2026-04-15T12:00:00Z | copilot | remove unused catch param to satisfy lint
 */

import React, { useState } from 'react';

type Props = {
  onSuccess?: (trialId: string) => void;
};

export default function TrialSignup({ onSuccess }: Props) {
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [childClass, setChildClass] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!phone || phone.trim().length < 6) {
      setError('Please enter a valid phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentName: parentName || undefined,
          phone,
          childClass: childClass || undefined,
          schoolName: schoolName || undefined,
        }),
      });
      const js = await res.json();
      if (!res.ok) {
        setError(js?.error || 'Could not start trial');
      } else {
        setSuccess('Trial started! Check WhatsApp for updates.');
        setParentName('');
        setPhone('');
        setChildClass('');
        setSchoolName('');
        if (js?.trialId && onSuccess) onSuccess(js.trialId);
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md">
      <div className="mb-3">
        <label className="block text-sm font-medium">Parent name</label>
        <input
          value={parentName}
          onChange={(e) => setParentName(e.target.value)}
          className="mt-1 block w-full rounded-md border p-2"
          placeholder="e.g., Rahul Sharma"
        />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium">WhatsApp / Phone</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 block w-full rounded-md border p-2"
          placeholder="Enter phone e.g., 91xxxxxxxxxx"
        />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium">Child's class (optional)</label>
        <input
          value={childClass}
          onChange={(e) => setChildClass(e.target.value)}
          className="mt-1 block w-full rounded-md border p-2"
          placeholder="e.g., Class 10"
        />
      </div>
      <div className="mb-3">
        <label className="block text-sm font-medium">School (optional)</label>
        <input
          value={schoolName}
          onChange={(e) => setSchoolName(e.target.value)}
          className="mt-1 block w-full rounded-md border p-2"
          placeholder="School name"
        />
      </div>
      {error && <div className="text-sm text-red-600 mb-2">{error}</div>}
      {success && <div className="text-sm text-green-600 mb-2">{success}</div>}
      <div className="flex items-center gap-2">
        <button
          disabled={loading}
          type="submit"
          className="inline-flex items-center px-4 py-2 rounded-md bg-indigo-600 text-white"
        >
          {loading ? 'Starting...' : 'Start 14-day trial'}
        </button>
        <div className="text-sm text-gray-600">Inclusive of all taxes. No card required.</div>
      </div>
    </form>
  );
}
