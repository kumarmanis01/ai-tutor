/**
 * FILE OBJECTIVE:
 * - Production web entrypoint that starts Next.js on a Node HTTP server and bootstraps Socket.IO.
 *
 * LINKED UNIT TEST:
 * - tests/unit/server.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-04-25T00:00:00Z | copilot | created web runtime server bootstrap with Socket.IO initialization
 */

import http from 'http';
import next from 'next';
import { initSocketIO } from './lib/socket/server';
import { logger } from './lib/logger';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

export async function startWebServer(): Promise<http.Server> {
  const dev = process.env.NODE_ENV !== 'production';
  const app = next({ dev, hostname: host, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer((req, res) => handle(req, res));

  // Initialize the singleton once per process so route emitters are live.
  initSocketIO(server);

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once('error', rejectReady);
    server.listen(port, host, () => resolveReady());
  });

  logger.info('web.server.started', { host, port, socketPath: '/api/socket' });
  return server;
}

function isDirectExecution(): boolean {
  const argvPath = process.argv[1] ?? '';
  return /(?:^|[\\/])server\.(?:js|ts)$/.test(argvPath);
}

if (isDirectExecution()) {
  startWebServer().catch((err: unknown) => {
    logger.error('web.server.start.failed', { error: String(err) });
    process.exit(1);
  });
}
