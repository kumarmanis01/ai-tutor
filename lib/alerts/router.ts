import { AlertPayload, AlertRouterOptions, AlertSink } from './types';
import { alertsCounter, alertsDeduped, alertsRateLimited } from './metrics';

export class AlertRouter {
  private sinksByName: Map<string, AlertSink>;

  constructor(private opts: AlertRouterOptions) {
    this.sinksByName = new Map(opts.sinks.map(s => [s.name, s]));
  }

  private selectSinks(severity: import('./types').Severity) {
    const names: string[] = (this.opts.routing && this.opts.routing[severity]) ?? this.opts.sinks.map(s => s.name);
    return names.map(n => this.sinksByName.get(n)).filter(Boolean) as AlertSink[];
  }

  private dedupeKey(alert: AlertPayload) {
    // a simple dedupe key: title|message|severity
    return `${alert.title}|${alert.message}|${alert.severity}`;
  }

  async route(alert: AlertPayload): Promise<{ sink: string; result: any }[]> {
    alert.timestamp = alert.timestamp ?? new Date().toISOString();

    alertsCounter.inc({ severity: alert.severity }, 1);

    // dedupe
    const key = this.dedupeKey(alert);
    if (this.opts.deduper) {
      const dup = await this.opts.deduper.isDuplicate(key);
      if (dup) {
        alertsDeduped.inc();
        return [{ sink: 'dedupe', result: { success: false, details: 'duplicate' } }];
      }
    }

    // rate-limit
    if (this.opts.rateLimiter) {
      const allowed = await this.opts.rateLimiter.allow(key);
      if (!allowed) {
        alertsRateLimited.inc();
        return [{ sink: 'rate-limited', result: { success: false, details: 'rate limited' } }];
      }
    }

    if (this.opts.deduper) await this.opts.deduper.touch(key);

    const sinks = this.selectSinks(alert.severity);
    const results: { sink: string; result: any }[] = [];
    await Promise.all(
      sinks.map(async s => {
        try {
          const res = await s.send(alert);
          results.push({ sink: s.name, result: res });
        } catch (err) {
          results.push({ sink: s.name, result: { success: false, details: String(err) } });
        }
      })
    );

    return results;
  }
}
