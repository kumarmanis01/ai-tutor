#!/usr/bin/env node
/* eslint-disable no-console */
import 'dotenv/config'
import 'tsconfig-paths/register'
import workerDefault, { startWorker } from '../workers/regenerationWorker'

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
#!/usr/bin/env node
/* eslint-disable no-console */
import 'dotenv/config'
<<<<<<< HEAD
import 'tsconfig-paths/register.js'
=======
import 'tsconfig-paths/register'
>>>>>>> origin/develop
import workerDefault, { startWorker } from '../workers/regenerationWorker'

// prefer explicit startWorker export
const intervalMs = Number(process.env.WORKER_POLL_MS || 2000)
try {
  if (typeof startWorker === 'function') {
    startWorker({ intervalMs })
<<<<<<< HEAD
=======
  } else if (workerDefault && typeof (workerDefault as any).start === 'function') {
    // fallback
    ;(workerDefault as any).start({ intervalMs })
>>>>>>> origin/develop
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
