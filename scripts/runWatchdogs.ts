#!/usr/bin/env node
import { runWatchdogs } from '@/lib/watchdogs';

async function runOnce() {
  try {
    await runWatchdogs();
    console.log('watchdogs executed');
  } catch (err) {
    console.error('watchdogs failed', err);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  const interval = Number(process.env.WATCHDOG_INTERVAL_SEC || '60');
  if (process.env.RUN_ONCE === '1') {
    runOnce();
  } else {
    console.log(`starting watchdog runner interval ${interval}s`);
    runOnce();
    setInterval(runOnce, interval * 1000);
  }
}
