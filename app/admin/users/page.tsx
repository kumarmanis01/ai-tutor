'use client';
import { useEffect, useState } from 'react';
import { toast } from '@/lib/toast';

interface UserRow {
  id: string;
  email?: string;
  status: 'active' | 'banned' | 'suspended';
  role: 'user' | 'admin' | 'moderator' | 'support';
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [editedUsers, setEditedUsers] = useState<{ [id: string]: Partial<UserRow> }>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">User Management</h1>
      <table className="w-full border border-gray-300 dark:border-gray-700">
        <thead>
          <tr>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Email</th>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              Status
            </th>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">Role</th>
            <th className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              Actions
            </th>
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
                <button
                  className="px-2 py-1 bg-red-600 text-white rounded disabled:opacity-50"
                  disabled={deletingId === u.id}
                  onClick={() => handleDelete(u.id)}
                >
                  {deletingId === u.id ? 'Deleting...' : 'Delete'}
                </button>
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
