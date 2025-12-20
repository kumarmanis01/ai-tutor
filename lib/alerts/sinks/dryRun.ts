import { AlertSink, AlertPayload, SinkResult } from '../types';
import { logger } from '@/lib/logger';

export class DryRunSink implements AlertSink {
  name = 'dry-run';

  async send(alert: AlertPayload): Promise<SinkResult> {
    // Use the project's logger rather than console to respect logging policies
    logger?.info?.('alert_dry_run', { alert });
    return { success: true, details: 'dry-run logged' };
  }
}
