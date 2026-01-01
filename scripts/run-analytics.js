#!/usr/bin/env node
// Lightweight runner to execute TypeScript job in-node for local debugging.
// Registers ts-node and tsconfig-paths, then requires the TS module.
try {
  require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'commonjs' } })
} catch {
  console.error('ts-node is required to run this script. Run `npm i -D ts-node`')
  process.exit(1)
}

try {
  require('tsconfig-paths').register()
} catch {
  // ignore if not available; ts-node may still resolve relative imports
}

(async () => {
  try {
    const job = require('../src/jobs/analyticsJobs')
    if (!job || typeof job.runAnalyticsJobs !== 'function') {
      throw new Error('runAnalyticsJobs() not found in ../src/jobs/analyticsJobs')
    }
    const result = await job.runAnalyticsJobs()
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  } catch (err) {
    console.error('Error running analytics job:', err)
    process.exit(2)
  }
})()
