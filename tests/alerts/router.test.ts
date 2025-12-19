import { AlertRouter } from '../../lib/alerts/router';
import { InMemoryRateLimiter } from '../../lib/alerts/rateLimiter';
import { InMemoryDeduper } from '../../lib/alerts/dedupe';
import type { AlertSink, AlertPayload } from '../../lib/alerts/types';

class MockSink implements AlertSink {
  name: string;
  calls: AlertPayload[] = [];
  sendImpl: (a: AlertPayload) => Promise<any>;
  constructor(name: string, sendImpl?: (a: AlertPayload) => Promise<any>) {
    this.name = name;
    this.sendImpl = sendImpl ?? (async () => ({ success: true }));
  }
  async send(a: AlertPayload) {
    this.calls.push(a);
    return this.sendImpl(a);
  }
}

describe('AlertRouter', () => {
  describe('routing by severity', () => {
    test('routes to sinks based on severity map', async () => {
      const s1 = new MockSink('s1');
      const s2 = new MockSink('s2');
      const router = new AlertRouter({
        sinks: [s1, s2],
        routing: { info: ['s1'], warning: ['s1'], error: ['s2'], critical: ['s1', 's2'] },
      } as any);

      const res = await router.route({ title: 'T', message: 'm', severity: 'info' });
      expect(s1.calls.length).toBe(1);
      expect(s2.calls.length).toBe(0);
      expect(res.some(r => r.sink === 's1' && r.result.success)).toBe(true);
    });
  });

  describe('deduplication', () => {
    test('skips duplicate alerts within TTL', async () => {
      const s = new MockSink('s');
      const deduper = new InMemoryDeduper(60);
      const router = new AlertRouter({ sinks: [s], deduper } as any);

      const a = { title: 'dup', message: 'm', severity: 'error' } as any;
      const r1 = await router.route(a);
      expect(s.calls.length).toBe(1);
      const r2 = await router.route(a);
      // second call should be deduped
      expect(s.calls.length).toBe(1);
      expect(r2[0].sink).toBe('dedupe');
    });
  });

  describe('rate limiting', () => {
    test('blocks when rate limiter disallows', async () => {
      const s = new MockSink('s');
      const limiter = new InMemoryRateLimiter(1, 0); // low capacity
      // consume allowance
      await limiter.allow('key');
      const router = new AlertRouter({ sinks: [s], rateLimiter: limiter } as any);
      const r = await router.route({ title: 'r', message: 'm', severity: 'warning' } as any);
      expect(r[0].sink).toBe('rate-limited');
      expect(s.calls.length).toBe(0);
    });
  });

  describe('combined behavior', () => {
    test('dedupe wins over rate-limit and routing still applied', async () => {
      const s = new MockSink('s');
      const deduper = new InMemoryDeduper(60);
      const limiter = new InMemoryRateLimiter(0, 0); // will block
      const router = new AlertRouter({ sinks: [s], deduper, rateLimiter: limiter } as any);

      const payload = { title: 'x', message: 'y', severity: 'info' } as any;
      const first = await router.route(payload);
      expect(first.some(x => x.sink === 's')).toBe(true);

      const second = await router.route(payload);
      expect(second[0].sink).toBe('dedupe');
    });
  });

  describe('sink failures', () => {
    test('one failing sink does not stop others', async () => {
      const bad = new MockSink('bad', async () => { throw new Error('boom'); });
      const good = new MockSink('good');
      const router = new AlertRouter({ sinks: [bad, good] } as any);
      const res = await router.route({ title: 's', message: 'm', severity: 'critical' } as any);
      // both attempted; bad reports failure
      expect(bad.calls.length).toBe(1);
      expect(good.calls.length).toBe(1);
      const badRes = res.find(r => r.sink === 'bad')!.result;
      const goodRes = res.find(r => r.sink === 'good')!.result;
      expect(badRes.success).toBe(false);
      expect(goodRes.success).toBe(true);
    });
  });
});
