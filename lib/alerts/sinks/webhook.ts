import { AlertSink, AlertPayload, SinkResult } from '../types';

export interface WebhookSinkOptions {
  url: string;
  headers?: Record<string, string>;
}

export class WebhookSink implements AlertSink {
  name = 'webhook';
  constructor(private opts: WebhookSinkOptions) {}

  async send(alert: AlertPayload): Promise<SinkResult> {
    try {
      const res = await fetch(this.opts.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(this.opts.headers || {}) },
        body: JSON.stringify(alert),
      });
      if (!res.ok) return { success: false, details: `webhook returned ${res.status}` };
      return { success: true };
    } catch (err: any) {
      return { success: false, details: err?.message || String(err) };
    }
  }
}
