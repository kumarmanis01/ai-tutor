import client from 'prom-client';

const register = new client.Registry();

export const alertsCounter = new client.Counter({
  name: 'alerter_alerts_total',
  help: 'Total alerts evaluated',
  labelNames: ['severity'] as const,
  registers: [register],
});

export const alertsDeduped = new client.Counter({
  name: 'alerter_alerts_deduped_total',
  help: 'Total alerts deduped',
  registers: [register],
});

export const alertsRateLimited = new client.Counter({
  name: 'alerter_alerts_rate_limited_total',
  help: 'Total alerts rate limited',
  registers: [register],
});

export const sinkSuccess = new client.Counter({
  name: 'alerter_sink_success_total',
  help: 'Total sink successes',
  labelNames: ['sink'] as const,
  registers: [register],
});

export const sinkFailures = new client.Counter({
  name: 'alerter_sink_failures_total',
  help: 'Total sink failures',
  labelNames: ['sink'] as const,
  registers: [register],
});

export const circuitOpen = new client.Counter({
  name: 'alerter_circuit_open_total',
  help: 'Times a sink circuit opened',
  labelNames: ['sink'] as const,
  registers: [register],
});

export function metricsOutput(): Promise<string> {
  return register.metrics();
}

export default register;
