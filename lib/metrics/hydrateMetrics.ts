/*
 * Lightweight Prometheus-safe wrapper for hydrateAll metrics.
 * - Uses `prom-client` if available.
 * - Falls back to no-op functions when `prom-client` is not installed.
 */

type Timer = () => void;

let enabled = false;
let createdCounter: any = null;
let claimedCounter: any = null;
let completedCounter: any = null;
let failedCounter: any = null;
let durationHistogram: any = null;

function noopTimer(): Timer {
  return () => {};
}

try {
  // Use require to avoid top-level await and keep this file safe when prom-client is absent
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const prom = require('prom-client');

  createdCounter = new prom.Counter({
    name: 'hydrate_jobs_created_total',
    help: 'Total hydrate jobs created',
    labelNames: ['target'],
  });

  claimedCounter = new prom.Counter({
    name: 'hydrate_jobs_claimed_total',
    help: 'Total hydrate jobs claimed by workers',
    labelNames: ['target'],
  });

  completedCounter = new prom.Counter({
    name: 'hydrate_jobs_completed_total',
    help: 'Total hydrate jobs completed',
    labelNames: ['target'],
  });

  failedCounter = new prom.Counter({
    name: 'hydrate_jobs_failed_total',
    help: 'Total hydrate jobs failed',
    labelNames: ['target'],
  });

  durationHistogram = new prom.Histogram({
    name: 'hydrate_job_duration_seconds',
    help: 'Duration of hydrate jobs in seconds',
    labelNames: ['target'],
  });

  enabled = true;
} catch {
  // prom-client not installed or not available — fall back to no-op
  enabled = false;
}

export function isEnabled() {
  return enabled;
}

export function incrementCreated(target = 'unknown') {
  if (!enabled) return;
  try {
    createdCounter.inc({ target }, 1);
  } catch { /* metric emission is best-effort */ }
}

export function incrementClaimed(target = 'unknown') {
  if (!enabled) return;
  try {
    claimedCounter.inc({ target }, 1);
  } catch { /* metric emission is best-effort */ }
}

export function incrementCompleted(target = 'unknown') {
  if (!enabled) return;
  try {
    completedCounter.inc({ target }, 1);
  } catch { /* metric emission is best-effort */ }
}

export function incrementFailed(target = 'unknown') {
  if (!enabled) return;
  try {
    failedCounter.inc({ target }, 1);
  } catch { /* metric emission is best-effort */ }
}

// Start a timer for a particular target; returns a function to call to observe duration
export function startTimer(target = 'unknown'): Timer {
  if (!enabled) return noopTimer();
  try {
    const end = durationHistogram.startTimer({ target });
    return end as Timer;
  } catch {
    return noopTimer();
  }
}

// Export a small API for tests or integration
const hydrateMetricsAPI = {
  isEnabled,
  incrementCreated,
  incrementClaimed,
  incrementCompleted,
  incrementFailed,
  startTimer,
};

export default hydrateMetricsAPI;
