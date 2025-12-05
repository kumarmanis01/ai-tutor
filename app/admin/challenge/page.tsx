import { getServerSessionForHandlers } from '@/lib/session';
import AdminCreateChallenge from '@/components/AdminCreateChallenge';
import React from 'react';

type SessionUserWithRole = {
  role?: string | null;
} & Record<string, unknown>;

export default async function Page() {
  const session = await getServerSessionForHandlers();
  if (!session?.user) return <div className="p-6">Sign in as admin to manage challenges.</div>;

  const user = session.user as SessionUserWithRole;
  if (user.role !== 'admin') return <div className="p-6">Access denied.</div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Admin — Challenges</h1>
      <AdminCreateChallenge />
    </div>
  );
}
