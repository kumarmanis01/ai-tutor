import { prisma } from '@/lib/prisma';
import WorkersTable from '@/components/Admin/WorkersTable';

export const dynamic = 'force-dynamic';

export default async function WorkersPage() {
  const workers = await prisma.workerLifecycle.findMany({ orderBy: { lastHeartbeatAt: 'desc' }, take: 100 });

  // Serialize rows for client component
  const rows = workers.map((w) => ({
    id: w.id,
    type: w.type,
    status: w.status,
    lastHeartbeatAt: w.lastHeartbeatAt ? w.lastHeartbeatAt.toISOString() : null,
    host: w.host,
    pid: w.pid,
  }));

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Content Engine — Workers</h1>
      {/* Workers table is a client component to allow Stop actions */}
      <WorkersTable workers={rows as any} />
    </div>
  );
}
