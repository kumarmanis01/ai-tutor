/**
 * FILE OBJECTIVE:
 * - Super-admin invite form for creating admin accounts in INVITED state.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/team/CreateInviteForm.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:11:00Z | copilot | created create-admin invite form for A0.1 team page
 * - 2026-04-27T20:05:00Z | copilot | add explicit aria-label for role select accessibility compliance
 */

'use client';

import React, { useState } from 'react';

interface CreateInviteFormProps {
  onCreated: () => Promise<void>;
}

export function CreateInviteForm({ onCreated }: CreateInviteFormProps): React.ReactElement {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'CONTENT_ADMIN' | 'SUPPORT_ADMIN'>('CONTENT_ADMIN');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setIsSaving(true);
        setError(null);
        try {
          const res = await fetch('/api/v1/admin/invites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role }),
          });
          const data = (await res.json()) as { error?: string };
          if (!res.ok) {
            setError(data.error ?? 'Unable to create invite.');
            return;
          }
          setName('');
          setEmail('');
          setRole('CONTENT_ADMIN');
          await onCreated();
        } finally {
          setIsSaving(false);
        }
      }}
    >
      <h2 className="text-base font-semibold">Create Admin Invite</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <input
          type="text"
          required
          minLength={2}
          maxLength={100}
          placeholder="Full name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="min-h-[44px] rounded-lg border border-gray-300 px-3 py-2"
        />
        <input
          type="email"
          required
          placeholder="Work email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="min-h-[44px] rounded-lg border border-gray-300 px-3 py-2"
        />
        <select
          aria-label="Admin role"
          value={role}
          onChange={(event) => setRole(event.target.value as 'CONTENT_ADMIN' | 'SUPPORT_ADMIN')}
          className="min-h-[44px] rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="CONTENT_ADMIN">Content Admin</option>
          <option value="SUPPORT_ADMIN">Support Admin</option>
        </select>
      </div>
      {error ? <p className="text-sm text-[#E24B4A]">{error}</p> : null}
      <button
        type="submit"
        disabled={isSaving}
        className="min-h-[44px] w-full md:w-auto rounded-lg bg-[#534AB7] text-white font-semibold px-4 py-2 disabled:opacity-60"
      >
        {isSaving ? 'Creating invite...' : 'Create Invite'}
      </button>
    </form>
  );
}

export default CreateInviteForm;
