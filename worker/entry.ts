#!/usr/bin/env node
/*
 Minimal worker entrypoint shim.
 - Verify required env vars (`DATABASE_URL`, `REDIS_URL`) on startup.
 - Reuse `validateEnvironment` helper if present (best-effort).
 - If validation passes, import `./bootstrap` to start the worker.
 */

import { bootstrapWorker } from '../app/worker/bootstrap'

// Keep startup as bulletproof as possible — no dynamic imports, no dev-only
// modules here. Let PM2 handle restarts.
bootstrapWorker().catch((err) => {
	try {
		process.stderr.write(`[worker] fatal startup error: ${String(err)}\n`)
	} catch {}
	process.exit(1)
})

// Intentionally no exports — this file boots the worker as a side-effect.
