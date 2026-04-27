import { AlertRouter } from '@/lib/alerts/router';
import { SlackSink } from '@/lib/alerts/sinks/slack';
import { WebhookSink } from '@/lib/alerts/sinks/webhook';
import { EmailSink } from '@/lib/alerts/sinks/email';
import { InMemoryRateLimiter } from '@/lib/alerts/rateLimiter';
import { InMemoryDeduper } from '@/lib/alerts/dedupe';

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
