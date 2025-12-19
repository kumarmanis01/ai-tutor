import { AlertRouter } from '../../lib/alerts/router';
import { SlackSink } from '../../lib/alerts/sinks/slack';
import { WebhookSink } from '../../lib/alerts/sinks/webhook';
import { EmailSink } from '../../lib/alerts/sinks/email';
import { InMemoryRateLimiter } from '../../lib/alerts/rateLimiter';
import { InMemoryDeduper } from '../../lib/alerts/dedupe';

describe('AlertRouter', () => {
  const makeMockSlack = (name = 'slack') => {
    const s = new SlackSink({ webhookUrl: 'http://example.invalid' });
    // monkey-patch send to a mockable function
    (s as any).send = jest.fn().mockResolvedValue({ success: true });
    (s as any).name = name;
    return s;
  };

  const makeMockWebhook = (name = 'webhook') => {
    const s = new WebhookSink({ url: 'http://example.invalid' });
    (s as any).send = jest.fn().mockResolvedValue({ success: true });
    (s as any).name = name;
    return s;
  };

  const makeMockEmail = (name = 'email') => {
    const s = new EmailSink({ to: 'ops@example.com', sendMail: async () => {} });
    (s as any).send = jest.fn().mockResolvedValue({ success: true });
    (s as any).name = name;
    return s;
  };

  test('routing by severity sends to configured sinks', async () => {
    const slack = makeMockSlack('slack');
    const email = makeMockEmail('email');

    const router = new AlertRouter({
      sinks: [slack, email],
      routing: {
        info: ['slack'],
        warning: ['slack'],
        error: ['slack', 'email'],
        critical: ['slack', 'email'],
      },
    });

    const res = await router.route({ title: 'T', message: 'M', severity: 'error' });
    const sinks = res.map(r => r.sink).sort();
    expect(sinks).toEqual(['email', 'slack'].sort());
    expect((slack as any).send).toHaveBeenCalled();
    expect((email as any).send).toHaveBeenCalled();
  });

  test('deduplication prevents duplicate delivery', async () => {
    const slack = makeMockSlack('slack');
    const deduper = new InMemoryDeduper(60);
    const router = new AlertRouter({
      sinks: [slack],
      deduper,
    });

    const alert = { title: 'T', message: 'M', severity: 'info' } as any;
    const first = await router.route(alert);
    expect(first.find(f => f.sink === 'slack')?.result.success).toBe(true);

    const second = await router.route(alert);
    expect(second).toHaveLength(1);
    expect(second[0].sink).toBe('dedupe');
    expect(second[0].result.success).toBe(false);
    expect((slack as any).send).toHaveBeenCalledTimes(1);
  });

  test('rate limiter blocks when not allowed', async () => {
    const slack = makeMockSlack('slack');
    const limiter = new InMemoryRateLimiter(0, 0); // capacity 0 -> deny
    const router = new AlertRouter({ sinks: [slack], rateLimiter: limiter });

    const res = await router.route({ title: 'T', message: 'M', severity: 'info' } as any);
    expect(res).toHaveLength(1);
    expect(res[0].sink).toBe('rate-limited');
    expect(res[0].result.success).toBe(false);
    expect((slack as any).send).not.toHaveBeenCalled();
  });

  test('dedupe takes precedence over rate-limit', async () => {
    const slack = makeMockSlack('slack');
    const deduper = new InMemoryDeduper(60);
    const limiter = new InMemoryRateLimiter(0, 0);
    const router = new AlertRouter({ sinks: [slack], deduper, rateLimiter: limiter });

    const alert = { title: 'T', message: 'M', severity: 'info' } as any;
    const first = await router.route(alert);
    // first allowed (rate-limiter may block, but capacity default is >0) — to ensure touch
    // If first was rate-limited, touch directly
    if (first[0].sink === 'rate-limited') {
      // touch deduper explicitly to simulate prior send
      await deduper.touch(`${alert.title}|${alert.message}|${alert.severity}`);
    }

    // now simulate a duplicate
    await deduper.touch(`${alert.title}|${alert.message}|${alert.severity}`);
    const second = await router.route(alert);
    expect(second).toHaveLength(1);
    expect(second[0].sink).toBe('dedupe');
  });

  test('sink failures do not block other sinks and results are returned', async () => {
    const slack = makeMockSlack('slack');
    const webhook = makeMockWebhook('webhook');
    // make slack fail
    (slack as any).send = jest.fn().mockResolvedValue({ success: false, details: 'boom' });
    // make webhook throw
    (webhook as any).send = jest.fn().mockImplementation(() => {
      throw new Error('network');
    });

    const router = new AlertRouter({ sinks: [slack, webhook] });
    const res = await router.route({ title: 'T', message: 'M', severity: 'error' } as any);
    const bySink = Object.fromEntries(res.map(r => [r.sink, r.result]));
    expect(bySink.slack.success).toBe(false);
    expect(bySink.webhook.success).toBe(false);
    expect((slack as any).send).toHaveBeenCalled();
    expect((webhook as any).send).toHaveBeenCalled();
  });
});
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
