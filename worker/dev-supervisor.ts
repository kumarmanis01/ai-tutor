import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { CONTENT_HYDRATION_QUEUE } from '@/lib/queues/constants';

// DEV SUPERVISOR
// This starts all required worker-side processes for local HydrateAll:
// - content-hydration worker (BullMQ)
// - scheduler (runs hydration reconciler every 2 minutes)
//
// Keeping scheduler separate avoids coupling production worker entrypoints to
// recurring cron-like tasks while still making local dev one-command.

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

function tsxBin(): string {
  // Use local tsx binary so this works cross-platform without npx.
  const bin = process.platform === 'win32' ? 'tsx.cmd' : 'tsx';
  return path.resolve(process.cwd(), 'node_modules', '.bin', bin);
}

type Child = ReturnType<typeof spawn>;

function spawnTsx(args: string[], name: string): Child {
  const bin = tsxBin();
  if (!fs.existsSync(bin)) {
    // eslint-disable-next-line no-console
    console.error(`[dev-supervisor] Cannot find tsx binary at ${bin}`);
    // eslint-disable-next-line no-console
    console.error('[dev-supervisor] Run `npm i` to install dev dependencies.');
    process.exit(1);
  }

  // On Windows, spawning a .cmd directly can throw EINVAL unless invoked through a shell.
  const child = spawn(bin, args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  });

  child.on('exit', (code, signal) => {
    // If a child exits unexpectedly, end the supervisor so it’s obvious in dev.
    // (Keeping this strict prevents silent missing reconciler/worker issues.)
    const msg = signal
      ? `${name} exited via signal ${signal}`
      : `${name} exited with code ${code}`;
    // eslint-disable-next-line no-console
    console.error(`[dev-supervisor] ${msg}`);
    if (code && code !== 0) process.exitCode = code;
    // Ensure supervisor terminates when either child terminates.
    process.exit(code ?? 0);
  });

  return child;
}

const children: Child[] = [];

children.push(spawnTsx(['worker/dev-entry.ts', '--type', CONTENT_HYDRATION_QUEUE], 'content-hydration-worker'));
children.push(spawnTsx(['worker/scheduler.ts'], 'scheduler'));

function shutdown(signal: string) {
  // eslint-disable-next-line no-console
  console.log(`[dev-supervisor] shutting down (${signal})`);
  for (const c of children) {
    try {
      c.kill('SIGTERM');
    } catch {
      // ignore
    }
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

