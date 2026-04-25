import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getServerSessionForHandlers } from '@/lib/session';
import { logger } from '@/lib/logger';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await getServerSessionForHandlers();
  if (!session || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // pm2 process name is configurable; default matches the VPS setup.
  const workerName = process.env.WORKER_PM2_NAME || 'content-engine-worker';

  try {
    const { stdout, stderr } = await execFileAsync('pm2', ['restart', workerName], {
      timeout: 20_000,
    });
    logger.info('[admin] worker restarted via admin panel', {
      event: 'worker_restart',
      context: { workerName, requestedBy: session.user.id },
    });
    return NextResponse.json({
      ok: true,
      message: `Restarted ${workerName}`,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    });
  } catch (err: any) {
    logger.error('[admin] worker restart failed', {
      event: 'worker_restart_failed',
      context: { workerName, error: err?.message },
    });
    return NextResponse.json({ error: err?.message ?? 'Restart failed' }, { status: 500 });
  }
}
