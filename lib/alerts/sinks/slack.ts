import { AlertSink, AlertPayload, SinkResult } from '../types';

export interface SlackSinkOptions {
  webhookUrl: string;
  channel?: string;
  username?: string;
}

export class SlackSink implements AlertSink {
  name = 'slack';
  constructor(private opts: SlackSinkOptions) {}

  async send(alert: AlertPayload): Promise<SinkResult> {
    try {
      const body = {
        text: `*${alert.title}*\n${alert.message}`,
      } as any;
      if (this.opts.channel) body.channel = this.opts.channel;
      if (this.opts.username) body.username = this.opts.username;

      const res = await fetch(this.opts.webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return { success: false, details: `slack webhook returned ${res.status}` };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, details: err?.message || String(err) };
    }
  }
}
