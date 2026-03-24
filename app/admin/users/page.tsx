'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

interface UserRow {
  id: string;
  email?: string;
  status: 'active' | 'banned' | 'suspended';
  role: 'user' | 'admin' | 'moderator' | 'support';
}

interface NotifyTarget {
  id: string;
  email?: string;
}

function NotifyModal({ target, onClose }: { target: NotifyTarget; onClose: () => void }) {
  const [type, setType] = useState<'push' | 'email'>('push');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    const res = await fetch('/api/admin/notifications/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: target.id, type, title, body }),
    });
    setSending(false);
    if (res.ok) {
      toast('Notification sent.');
      onClose();
    } else {
      toast('Failed to send notification.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Notify User</h2>
        <p className="text-sm text-gray-500 mb-4">{target.email || target.id}</p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <div className="flex gap-3">
            {(['push', 'email'] as const).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`px-3 py-1.5 rounded text-sm min-h-[36px] ${type === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                {t === 'push' ? 'Push notification' : 'Email'}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Notification title"
            className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Message body"
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          />
        </div>

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded min-h-[36px]"
          >
            Cancel
          </button>
          <button
            disabled={!title.trim() || !body.trim() || sending}
            onClick={handleSend}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded disabled:opacity-50 min-h-[36px]"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editedUsers, setEditedUsers] = useState<{ [id: string]: Partial<UserRow> }>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notifyTarget, setNotifyTarget] = useState<NotifyTarget | null>(null);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then((data: UserRow[]) => setUsers(data));
  }, []);

  const handleEdit = (id: string, field: keyof UserRow, value: string) => {
    setEditedUsers((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
    setUsers((users) => users.map((u) => (u.id === id ? { ...u, [field]: value } : u)));
  };

  const handleSave = async () => {
    setSaving(true);
    await Promise.all(
      Object.entries(editedUsers).map(([id, data]) =>
        fetch(`/api/admin/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
      ),
    );
    setEditedUsers({});
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    setDeletingId(id);
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } else {
      toast('Failed to delete user.');
    }
    setDeletingId(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-8 pt-20 bg-white dark:bg-gray-900 min-h-screen transition-colors">
      {notifyTarget && (
        <NotifyModal target={notifyTarget} onClose={() => setNotifyTarget(null)} />
      )}

      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">User Management</h1>
      <table className="w-full border border-gray-300 dark:border-gray-700">
        <thead>
          <tr>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Email</th>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Status</th>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Role</th>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t border-gray-200 dark:border-gray-700">
              <td className="text-gray-900 dark:text-gray-100">{u.email}</td>
              <td>
                <select
                  value={u.status}
                  onChange={(e) => handleEdit(u.id, 'status', e.target.value)}
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded px-2 py-1"
                >
                  <option value="active">active</option>
                  <option value="banned">banned</option>
                  <option value="suspended">suspended</option>
                </select>
              </td>
              <td>
                <select
                  value={u.role}
                  onChange={(e) => handleEdit(u.id, 'role', e.target.value)}
                  className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-700 rounded px-2 py-1"
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="moderator">moderator</option>
                  <option value="support">support</option>
                </select>
              </td>
              <td>
                <div className="flex gap-2 flex-wrap">
                  <button
                    className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded text-sm min-h-[32px]"
                    onClick={() => setNotifyTarget({ id: u.id, email: u.email })}
                  >
                    Notify
                  </button>
                  <button
                    className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50 text-sm min-h-[32px]"
                    disabled={deletingId === u.id}
                    onClick={() => handleDelete(u.id)}
                  >
                    {deletingId === u.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
        onClick={handleSave}
        disabled={Object.keys(editedUsers).length === 0 || saving}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
