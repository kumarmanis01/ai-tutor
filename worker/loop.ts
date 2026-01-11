#!/usr/bin/env node
/* eslint-disable no-console */
// No runtime env-file loader or tsconfig-paths in production worker.
// Environment is validated by `worker/entry.ts` before bootstrap.
// Register scheduled jobs only in worker processes. This import has no runtime
// export; it registers job definitions via side-effects. It MUST NOT be
// imported by the web process.
import '../lib/jobs/registerJobs.js'
import workerDefault, { startWorker } from './processors/regenerationWorker.js'

// prefer explicit startWorker export
const intervalMs = Number(process.env.WORKER_POLL_MS || 2000)
try {
  if (typeof startWorker === 'function') {
    startWorker({ intervalMs })
  } else if (workerDefault && typeof (workerDefault as any).start === 'function') {
    // fallback
    ;(workerDefault as any).start({ intervalMs })
  } else if (workerDefault && typeof (workerDefault as any).startWorker === 'function') {
    ;(workerDefault as any).startWorker({ intervalMs })
  } else {
    console.error('No worker start function found; exiting')
    process.exit(2)
  }
} catch (err: any) {
  console.error('Failed to start worker', err)
  process.exit(2)
}
// End of entry script
