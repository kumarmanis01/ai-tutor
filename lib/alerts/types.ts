export type Severity = 'info' | 'warning' | 'error' | 'critical';

export interface AlertPayload {
  id?: string; // optional client-provided id
  title: string;
  message: string;
  severity: Severity;
  meta?: Record<string, unknown>;
  timestamp?: string;
}

export interface SinkResult {
  success: boolean;
  details?: string;
}

export interface AlertSink {
  name: string;
  send(alert: AlertPayload): Promise<SinkResult>;
}

export interface AlertRouterOptions {
  sinks: AlertSink[];
  routing?: Partial<Record<Severity, string[]>>; // sink names per severity
  rateLimiter?: RateLimiter;
  deduper?: Deduper;
}

export interface RateLimiter {
  allow(key: string, points?: number): Promise<boolean>;
}

export interface Deduper {
  isDuplicate(key: string): Promise<boolean>;
  touch(key: string): Promise<void>;
}
