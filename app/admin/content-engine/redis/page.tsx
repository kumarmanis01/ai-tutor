import React from 'react';

async function getRedis() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const res = await fetch(`${base}/api/admin/content-engine/redis`, { cache: 'no-store' });
  if (!res.ok) return null;
  return res.json();
}

export default async function RedisPage() {
  const data = await getRedis();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Content Engine — Redis</h1>
      {!data && <div className="text-sm text-gray-500">Unable to fetch Redis health.</div>}
      {data && (
        <div className="bg-white dark:bg-gray-900 rounded shadow p-4">
          <pre className="text-sm whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
