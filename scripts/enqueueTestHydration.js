#!/usr/bin/env node
import path from 'path'

async function main() {
  try {
    const modPath = path.join(process.cwd(), 'dist/worker/producers/enqueueTestHydration.js')
    const mod = await import(modPath)
    const argv = process.argv.slice(2)
    // Accept either first arg as testId or --testId=xxx / --testId xxx
    let testId = argv[0]
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i]
      if (a.startsWith('--testId=')) testId = a.split('=')[1]
      if (a === '--testId' && argv[i + 1]) testId = argv[i + 1]
    }
    if (!testId) testId = `local-${Date.now()}`
    const jobId = await mod.enqueueTestHydration(testId)
    console.log('Enqueued test hydration job:', jobId)
    process.exit(0)
  } catch (err) {
    console.error('Failed to enqueue test hydration job', err)
    process.exit(1)
  }
}

void main()
