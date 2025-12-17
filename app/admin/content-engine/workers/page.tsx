import { prisma } from '@/lib/prisma';

export default async function WorkersPage() {
  const workers = await prisma.workerLifecycle.findMany({ orderBy: { lastHeartbeatAt: 'desc' }, take: 100 });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Content Engine — Workers</h1>
      <div className="bg-white dark:bg-gray-900 rounded shadow overflow-x-auto">
        <table className="w-full table-fixed">
          <thead className="text-left text-sm text-gray-600 dark:text-gray-300">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Type</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last heartbeat</th>
              <th className="p-3">Host / PID</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w) => (
              <tr key={w.id} className="border-t border-gray-100 dark:border-gray-800">
                <td className="p-3 text-sm truncate">{w.id}</td>
                <td className="p-3 text-sm">{w.type}</td>
                <td className="p-3 text-sm">{w.status}</td>
                <td className="p-3 text-sm">{w.lastHeartbeatAt ? new Date(w.lastHeartbeatAt).toLocaleString() : '—'}</td>
                <td className="p-3 text-sm">{w.host ?? '—'} / {w.pid ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
