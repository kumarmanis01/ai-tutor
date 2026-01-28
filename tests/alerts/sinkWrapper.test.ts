import { SinkWrapper } from '@/lib/alerts/sinkWrapper';
import type { AlertSink, AlertPayload, SinkResult } from '@/lib/alerts/types';

class FlakySink implements AlertSink {
  name = 'flaky';
  calls = 0;
  failTimes: number;
  constructor(failTimes = 2) { this.failTimes = failTimes; }
  async send(_: AlertPayload) {
    void _;
    this.calls += 1;
    if (this.calls <= this.failTimes) {
      throw new Error('network');
    }
    return { success: true };
  }
}

class AlwaysFailSink implements AlertSink {
  name = 'always';
  async send(_: AlertPayload): Promise<SinkResult> { void _; throw new Error('boom'); }
}

describe('SinkWrapper', () => {
  test('retries on failure and eventually succeeds', async () => {
    const s = new FlakySink(2);
    const w = new SinkWrapper(s, { retries: 3, backoffMs: 1 });
    const res = await w.send({ title: 't', message: 'm', severity: 'error' } as any);
    expect(res.success).toBe(true);
    expect(s.calls).toBeGreaterThan(1);
  });

  test('opens circuit after repeated failures', async () => {
    const s = new AlwaysFailSink();
    const w = new SinkWrapper(s, { retries: 0, circuitBreakerOptions: { failureThreshold: 2, timeoutMs: 10 } });
    const r1 = await w.send({ title: 'x', message: 'y', severity: 'info' } as any);
    expect(r1.success).toBe(false);
    const r2 = await w.send({ title: 'x', message: 'y', severity: 'info' } as any);
    expect(r2.success).toBe(false);
    // third attempt should be blocked by circuit (state OPEN)
    const r3 = await w.send({ title: 'x', message: 'y', severity: 'info' } as any);
    expect(r3.details).toBe('circuit-open');
  });
});
