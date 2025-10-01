'use client';
import { useEffect, useState } from 'react';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((res) => res.json())
      .then(setUsers);
  }, []);

  const updateUser = async (id: string, data: any) => {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    setUsers((users) => users.map((u) => (u.id === id ? { ...u, ...data } : u)));
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
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
          {users.map((u: any) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>
                <select
                  value={u.status}
                  onChange={(e) => updateUser(u.id, { status: e.target.value })}
                >
                  <option value="active">active</option>
                  <option value="banned">banned</option>
                  <option value="suspended">suspended</option>
                </select>
              </td>
              <td>
                <select value={u.role} onChange={(e) => updateUser(u.id, { role: e.target.value })}>
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
    </div>
  );
}
