import type { AlertSink, AlertPayload, SinkResult } from './types';
import CircuitBreaker, { CircuitBreakerOptions } from './circuitBreaker';
import { sinkSuccess, sinkFailures, circuitOpen } from './metrics';

export interface SinkWrapperOptions {
  retries?: number;
  backoffMs?: number; // base backoff (exponential)
  circuitBreakerOptions?: CircuitBreakerOptions;
}

export class SinkWrapper implements AlertSink {
  name: string;
  private sink: AlertSink;
  private retries: number;
  private backoffMs: number;
  private cb: CircuitBreaker;

  constructor(sink: AlertSink, opts: SinkWrapperOptions = {}) {
    this.sink = sink;
    this.name = sink.name;
    this.retries = opts.retries ?? 2;
    this.backoffMs = opts.backoffMs ?? 100;
    this.cb = new CircuitBreaker(opts.circuitBreakerOptions);
  }

  private sleep(ms: number) {
    return new Promise(res => setTimeout(res, ms));
  }

  async send(a: AlertPayload): Promise<SinkResult> {
    if (!this.cb.canRequest()) {
      circuitOpen.inc({ sink: this.name }, 1);
      return { success: false, details: 'circuit-open' };
    }

    let attempt = 0;
    while (attempt <= this.retries) {
      try {
        const res = await this.sink.send(a);
        if (res && res.success) {
          this.cb.onSuccess();
          sinkSuccess.inc({ sink: this.name }, 1);
        } else {
          this.cb.onFailure();
          sinkFailures.inc({ sink: this.name }, 1);
        }
        return res;
      } catch (err) {
        this.cb.onFailure();
        attempt += 1;
        if (attempt > this.retries) {
          return { success: false, details: String(err) };
        }
        const wait = this.backoffMs * Math.pow(2, attempt - 1);
        await this.sleep(wait);
      }
    }
    return { success: false, details: 'unknown' };
  }
}

export default SinkWrapper;
