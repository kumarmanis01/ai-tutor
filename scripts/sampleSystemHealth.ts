#!/usr/bin/env node
// Simple sampling runner for system health. Can be run as a cron or long-running process.
import { sampleSystemHealth } from '@/lib/telemetry';

async function runOnce() {
  try {
    await sampleSystemHealth();
    console.log('sampled system health');
  } catch (err) {
    console.error('sampling failed', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  const interval = Number(process.env.SAMPLE_INTERVAL_SEC || '60');
  if (process.env.RUN_ONCE === '1') {
    runOnce();
  } else {
    console.log(`starting sampler interval ${interval}s`);
    runOnce();
    setInterval(runOnce, interval * 1000);
  }
}
