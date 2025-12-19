import { AlertSink, AlertPayload, SinkResult } from '../types';

export interface EmailSinkOptions {
  // The library for sending email is intentionally left pluggable
  // Provide an async `sendMail` fn: (opts) => Promise<void>
  sendMail: (opts: { to: string; subject: string; text: string; html?: string }) => Promise<void>;
  to: string;
  from?: string;
}

export class EmailSink implements AlertSink {
  name = 'email';
  constructor(private opts: EmailSinkOptions) {}

  async send(alert: AlertPayload): Promise<SinkResult> {
    try {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
      const text = `${alert.message}\n\nmeta: ${JSON.stringify(alert.meta || {})}`;
      await this.opts.sendMail({ to: this.opts.to, subject, text });
      return { success: true };
    } catch (err: any) {
      return { success: false, details: err?.message || String(err) };
    }
  }
}
