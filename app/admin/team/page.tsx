/**
 * FILE OBJECTIVE:
 * - Super Admin team management page for A0.1 create/list/invite lifecycle actions.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/admin/team/page.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:14:00Z | copilot | created admin team page using CreateInviteForm and AdminListTable
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import CreateInviteForm from '@/components/admin/team/CreateInviteForm';
import AdminListTable, { type AdminListItem } from '@/components/admin/team/AdminListTable';

interface InviteListResponse {
  ok?: boolean;
  items?: AdminListItem[];
}

export default function AdminTeamPage(): React.ReactElement {
  const [items, setItems] = useState<AdminListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/v1/admin/invites', { cache: 'no-store' });
    const data = (await res.json()) as InviteListResponse & { error?: string };
    if (!res.ok) {
      setError(data.error ?? 'Unable to load admin invites.');
      return;
    }
    setItems(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Admin Team</h1>
        <p className="text-sm text-gray-600">Create admin invites and manage account status.</p>
      </header>

      <CreateInviteForm onCreated={load} />
      {error ? <p className="text-sm text-[#E24B4A]">{error}</p> : null}
      <AdminListTable items={items} onRefresh={load} />
    </main>
  );
}
