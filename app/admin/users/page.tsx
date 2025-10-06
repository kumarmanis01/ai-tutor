'use client';
import { useEffect, useState } from 'react';

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

  return (
    <div className="max-w-4xl mx-auto p-8 pt-20 text-gray-900 dark:text-gray-100">
      <h1 className="text-2xl font-bold mb-4">User Management</h1>
      <table className="w-full border">
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>
                <select
                  value={u.status}
                  onChange={(e) => handleEdit(u.id, 'status', e.target.value)}
                >
                  <option value="active">active</option>
                  <option value="banned">banned</option>
                  <option value="suspended">suspended</option>
                </select>
              </td>
              <td>
                <select value={u.role} onChange={(e) => handleEdit(u.id, 'role', e.target.value)}>
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                  <option value="moderator">moderator</option>
                  <option value="support">support</option>
                </select>
              </td>
              <td>{/* Add more admin actions here */}</td>
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
