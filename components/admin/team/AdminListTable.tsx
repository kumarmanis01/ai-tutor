/**
 * FILE OBJECTIVE:
 * - Admin list table with A0.1 actions: resend, suspend, reactivate, and soft delete.
 *
 * LINKED UNIT TEST:
 * - tests/unit/components/admin/team/AdminListTable.spec.tsx
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-27T19:11:00Z | copilot | created admin list table for invite lifecycle actions
 */

'use client';

import React from 'react';

export interface AdminListItem {
  id: string;
  role: string;
  status: string;
  invitedAt?: string | null;
  inviteExpiresAt?: string | null;
  user: {
    name: string | null;
    email: string | null;
  };
}

interface AdminListTableProps {
  items: AdminListItem[];
  onRefresh: () => Promise<void>;
}

async function callAction(path: string, method = 'POST'): Promise<void> {
  const res = await fetch(path, { method });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Request failed');
  }
}

export function AdminListTable({ items, onRefresh }: AdminListTableProps): React.ReactElement {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="p-3">Name</th>
            <th className="p-3">Email</th>
            <th className="p-3">Role</th>
            <th className="p-3">Status</th>
            <th className="p-3">Invite Sent</th>
            <th className="p-3">Expires</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-gray-100">
              <td className="p-3">{item.user.name ?? '-'}</td>
              <td className="p-3">{item.user.email ?? '-'}</td>
              <td className="p-3">{item.role.replace(/_/g, ' ')}</td>
              <td className="p-3">{item.status}</td>
              <td className="p-3">{item.invitedAt ? new Date(item.invitedAt).toLocaleString() : '-'}</td>
              <td className="p-3">{item.inviteExpiresAt ? new Date(item.inviteExpiresAt).toLocaleString() : '-'}</td>
              <td className="p-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await callAction(`/api/v1/admin/invites/${item.id}/resend`, 'POST');
                      await onRefresh();
                    }}
                    className="min-h-[36px] rounded border border-gray-300 px-2 py-1"
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await callAction(`/api/v1/admin/invites/${item.id}/suspend`, 'PATCH');
                      await onRefresh();
                    }}
                    className="min-h-[36px] rounded border border-[#E24B4A] text-[#E24B4A] px-2 py-1"
                  >
                    Suspend
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await callAction(`/api/v1/admin/invites/${item.id}/reactivate`, 'PATCH');
                      await onRefresh();
                    }}
                    className="min-h-[36px] rounded border border-[#1D9E75] text-[#1D9E75] px-2 py-1"
                  >
                    Reactivate
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await callAction(`/api/v1/admin/invites/${item.id}`, 'DELETE');
                      await onRefresh();
                    }}
                    className="min-h-[36px] rounded border border-gray-400 text-gray-700 px-2 py-1"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default AdminListTable;
