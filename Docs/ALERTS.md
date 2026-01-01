**Alerting — Phase 5(D)**

Overview
- Provides pluggable sinks: Slack, Email, Webhook.
- Severity-aware routing and default configuration.
- In-memory rate-limiter and deduper with Redis hooks recommended for production.

Files
- `lib/alerts/types.ts` — shared types and interfaces.
- `lib/alerts/sinks/slack.ts` — Slack webhook sink.
- `lib/alerts/sinks/webhook.ts` — generic webhook sink.
- `lib/alerts/sinks/email.ts` — pluggable email sink (expects a sendMail fn).
- `lib/alerts/rateLimiter.ts` — in-memory rate limiter (replace with Redis in prod).
- `lib/alerts/dedupe.ts` — in-memory deduper (replace with Redis SET + EXPIRE in prod).
- `lib/alerts/router.ts` — router that applies routing, rate-limiting, dedupe, and dispatch.
 - `lib/alerts/rateLimiter.ts` — in-memory rate limiter (replace with Redis in prod).
 - `lib/alerts/dedupe.ts` — in-memory deduper (replace with Redis SET + EXPIRE in prod).
 - `lib/alerts/redisRateLimiter.ts` — Redis-backed rate limiter implementation (recommended for prod).
 - `lib/alerts/redisDeduper.ts` — Redis-backed deduper implementation (recommended for prod).
 - `lib/alerts/router.ts` — router that applies routing, rate-limiting, dedupe, and dispatch.

Usage example

```ts
import { AlertRouter } from '../lib/alerts/router';
import { SlackSink } from '../lib/alerts/sinks/slack';
import { WebhookSink } from '../lib/alerts/sinks/webhook';
import { EmailSink } from '../lib/alerts/sinks/email';
import { InMemoryRateLimiter } from '../lib/alerts/rateLimiter';
import { InMemoryDeduper } from '../lib/alerts/dedupe';

const router = new AlertRouter({
  sinks: [
    new SlackSink({ webhookUrl: process.env.SLACK_WEBHOOK! }),
    new WebhookSink({ url: process.env.PAGER_WEBHOOK! }),
    new EmailSink({ to: 'ops@example.com', sendMail: async (opts) => { /* call nodemailer */ } }),
  ],
  routing: {
    info: ['slack'],
    warning: ['slack'],
    error: ['slack', 'email'],
    critical: ['slack', 'email', 'webhook'],
  },
  rateLimiter: new InMemoryRateLimiter(5, 0.2),
  deduper: new InMemoryDeduper(60*10),
});

await router.route({ title: 'Test', message: 'Something happened', severity: 'error' });
```

Production notes
- Replace `InMemoryRateLimiter` and `InMemoryDeduper` with Redis-backed implementations for horizontal safety.
  You can use the provided classes:

  ```ts
  import { RedisRateLimiter } from '../lib/alerts/redisRateLimiter';
  import { RedisDeduper } from '../lib/alerts/redisDeduper';

  const rl = new RedisRateLimiter({ capacity: 10, windowSeconds: 60 });
  const ded = new RedisDeduper({ ttlSeconds: 60 * 10 });
  ```

- For Slack: use official sign-secret verification for security when receiving events.
- Add retries/backoff for sinks and circuit-breaker for flaky sinks.

- Important: lazy-initialize Redis clients (the implementations do this by default when `REDIS_URL` is set), and provide a shared `ioredis` instance when possible to avoid connection explosion.

Running the evaluator in dry-run mode
- Local (requires `DATABASE_URL`):

```powershell
# Run once, dry-run mode (no external notifications)
$env:DATABASE_URL = "postgres://user:pass@localhost:5432/testdb"
$env:RUN_ONCE = "1"
$env:EVALUATOR_DRY_RUN = "1"
node build/runAlertEvaluator.js

Deployment and metrics
- See `docs/evaluator_deploy_snippets.md` for systemd / Procfile / Helm examples.
- A Next.js route is added at `/api/metrics` to expose Prometheus metrics via `prom-client` (preferred for single-app deployments).
- Alternatively the evaluator can run a standalone metrics server (`scripts/metricsServer.ts`) and push to a Pushgateway; configure `PUSHGATEWAY_URL` to enable push on graceful shutdown.
```

- CI: The repository includes an integration test `tests/integration/alert-evaluator-dry-run.test.js` which runs the evaluator in single-run dry-run mode. Ensure your CI job provides `DATABASE_URL`.
