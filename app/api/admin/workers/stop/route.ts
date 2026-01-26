import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { hostname } from 'os';

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const id = body && body.id;
    if (!id) return NextResponse.json({ error: 'missing id' }, { status: 400 });

    const worker = await prisma.workerLifecycle.findUnique({ where: { id } });
    if (!worker) return NextResponse.json({ error: 'worker not found' }, { status: 404 });

    // Only allow stopping workers that report local host or empty host
    const host = (worker.host || '').toLowerCase();
    const isLocal = !host || host.includes('localhost') || host.includes('127.0.0.1') || host === hostname().toLowerCase();

    if (!isLocal) return NextResponse.json({ error: 'refusing to stop remote host worker' }, { status: 403 });

    const pid = worker.pid;
    if (!pid) return NextResponse.json({ error: 'no pid for worker' }, { status: 400 });

    // Attempt to gracefully kill the process. Use platform-appropriate command on Windows.
    const isWin = process.platform === 'win32';
    const cmd = isWin ? `taskkill /PID ${pid} /T /F` : `kill -TERM ${pid}`;

    await new Promise<void>((resolve, reject) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) return reject(new Error(stderr || (err?.message ?? String(err))));
        resolve();
      });
    });

    // Mark worker record as stopped
    await prisma.workerLifecycle.update({ where: { id }, data: { status: 'stopped', stoppedAt: new Date() } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  } finally {
    try { await prisma.$disconnect(); } catch {}
  }
}
