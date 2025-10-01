'use client';

import Link from 'next/link';

export default function AdminHome() {
  return (
    <div className="max-w-2xl mx-auto p-8 pt-16">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      <ul className="space-y-4">
        <li>
          <Link href="/admin/users" className="text-blue-600 hover:underline text-lg">
            User Management
          </Link>
        </li>
        <li>
          <Link href="/admin/audit-logs" className="text-blue-600 hover:underline text-lg">
            Audit Logs
          </Link>
        </li>
        <li>
          <Link href="/admin/api-usage" className="text-blue-600 hover:underline text-lg">
            API Usage Stats
          </Link>
        </li>
        {/* Add more links as you add more admin features */}
      </ul>
    </div>
  );
}
