'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Avatar from '@/components/UI/Avatar';
import { SessionUser } from '@/lib/types';

export default function ProfilePage() {
  const { data: session } = useSession();
  const [subscription, setSubscription] = useState<{
    isPremium: boolean;
    plan?: string;
  }>({ isPremium: false });

  // Editable fields
  const [grade, setGrade] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      const res = await fetch('/api/subscription/status');
      const data = await res.json();
      setSubscription({ isPremium: data.isPremium, plan: data.plan });
    }
    if (session) fetchStatus();
  }, [session]);

  useEffect(() => {
    // Pre-fill editable fields from session if available
    if (session?.user) {
      setGrade((session.user as SessionUser).grade || '');
      setParentEmail((session.user as SessionUser).parentEmail || '');
    }
  }, [session]);

  if (!session) {
    return <div className="p-6">You are not signed in.</div>;
  }

  // Compute fallback initials (first letter of name or email)
  const fallback =
    session.user?.name?.charAt(0).toUpperCase() ||
    session.user?.email?.charAt(0).toUpperCase() ||
    '?';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    await fetch('/api/user/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grade, parentEmail }),
    });
    setSaving(false);
    setSuccess(true);
    setEditing(false);
    window.location.reload();
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Profile</h1>
      <div>
        <Avatar
          src={session.user?.image || undefined}
          alt={session.user?.name || session.user?.email || 'User avatar'}
          size={80}
          fallback={fallback}
          className="mb-2"
        />
      </div>
      <p>
        <strong>Name:</strong> {session.user?.name}
      </p>
      <p>
        <strong>Email:</strong> {session.user?.email}
      </p>
      <p>
        <strong>Subscription:</strong>{' '}
        {subscription.isPremium ? `Premium (${subscription.plan || 'pro'})` : 'Free'}
      </p>
      <form onSubmit={handleSave} className="space-y-2 max-w-xs">
        <div>
          <label className="block font-semibold">Grade:</label>
          {editing ? (
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-2 py-1 border rounded"
              placeholder="Grade"
            />
          ) : (
            <span>{grade || <span className="text-gray-400">Not set</span>}</span>
          )}
        </div>
        <div>
          <label className="block font-semibold">Parent Email:</label>
          {editing ? (
            <input
              type="email"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              className="w-full px-2 py-1 border rounded"
              placeholder="Parent's email"
            />
          ) : (
            <span>{parentEmail || <span className="text-gray-400">Not set</span>}</span>
          )}
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-1 bg-blue-600 text-white rounded"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="px-4 py-1 bg-gray-300 rounded"
              onClick={() => {
                setEditing(false);
                setSuccess(false);
                // Reset fields to session values
                setGrade((session.user as SessionUser).grade || '');
                setParentEmail((session.user as SessionUser).parentEmail || '');
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="px-4 py-1 bg-blue-600 text-white rounded"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        )}
        {success && <div className="text-green-600 text-sm">Profile updated!</div>}
      </form>
    </div>
  );
}
