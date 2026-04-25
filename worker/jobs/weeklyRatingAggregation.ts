/**
 * Weekly rating aggregation job -- F-ADM-010 AC-06
 *
 * Runs once per week. For each (activityType, activityRef) combination in
 * LearningSession, computes the average rating over the past 7 days.
 * Fires an email alert when the average drops below RATING_ALERT_THRESHOLD.
 *
 * Never throws -- logs errors and returns a safe result.
 */

import { prisma } from '@/lib/prisma.js';
import { logger } from '@/lib/logger.js';
import { sendMailSafe } from '@/lib/mailer.js';

const RATING_ALERT_THRESHOLD = 3;
const LOOKBACK_DAYS = 7;

export interface RatingAggregationResult {
  checked: number;
  alerted: number;
  period: { days: number; since: string };
}

interface RatingSummaryRow {
  activityType: string;
  activityRef: string | null;
  avgRating: number | null;
  ratedCount: bigint;
}

export async function runWeeklyRatingAggregation(): Promise<RatingAggregationResult> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  let rows: RatingSummaryRow[] = [];
  try {
    rows = await prisma.$queryRaw<RatingSummaryRow[]>`
      SELECT
        "activityType",
        "activityRef",
        AVG("rating")::float                AS "avgRating",
        COUNT(*) FILTER (WHERE "rating" IS NOT NULL)::bigint AS "ratedCount"
      FROM "LearningSession"
      WHERE "createdAt" >= ${since}
        AND "rating" IS NOT NULL
      GROUP BY "activityType", "activityRef"
      ORDER BY "avgRating" ASC
    `;
  } catch (err) {
    logger.error('weeklyRatingAggregation.queryFailed', {
      event: 'rating_aggregation_error',
      context: { since: since.toISOString() },
      error: err instanceof Error ? err.message : String(err),
    });
    return { checked: 0, alerted: 0, period: { days: LOOKBACK_DAYS, since: since.toISOString() } };
  }

  logger.info('weeklyRatingAggregation.results', {
    event: 'rating_aggregation_complete',
    context: { rowCount: rows.length, since: since.toISOString() },
  });

  const lowRatingRows = rows.filter(
    (r) => r.avgRating !== null && r.avgRating < RATING_ALERT_THRESHOLD
  );

  let alerted = 0;
  if (lowRatingRows.length > 0) {
    const oncallEmail = process.env.ONCALL_EMAIL;
    if (oncallEmail) {
      const lines = lowRatingRows.map((r) => {
        const ref = r.activityRef ?? '(no ref)';
        return `  - ${r.activityType} / ${ref}: avg rating ${Number(r.avgRating).toFixed(2)} (${Number(r.ratedCount)} ratings)`;
      });

      try {
        await sendMailSafe({
          to: oncallEmail,
          subject: `⚠️ Spinzy session rating alert: ${lowRatingRows.length} activity type(s) below ${RATING_ALERT_THRESHOLD}/5`,
          text: [
            `Weekly session rating report (last ${LOOKBACK_DAYS} days)`,
            ``,
            `The following activity types have average ratings below ${RATING_ALERT_THRESHOLD}/5:`,
            ...lines,
            ``,
            `Total activity types checked: ${rows.length}`,
            `Period: ${since.toISOString()} to now`,
          ].join('\n'),
          html: `<p>Weekly session rating report (last ${LOOKBACK_DAYS} days)</p>
<p>The following activity types have average ratings below <strong>${RATING_ALERT_THRESHOLD}/5</strong>:</p>
<ul>${lowRatingRows.map((r) => `<li><strong>${r.activityType} / ${r.activityRef ?? '(no ref)'}</strong>: avg ${Number(r.avgRating).toFixed(2)} (${Number(r.ratedCount)} ratings)</li>`).join('')}</ul>
<p>Total activity types checked: ${rows.length}</p>`,
        });
        alerted = lowRatingRows.length;
        logger.warn('weeklyRatingAggregation.alertSent', {
          event: 'rating_alert_sent',
          context: { lowCount: lowRatingRows.length, threshold: RATING_ALERT_THRESHOLD },
        });
      } catch (err) {
        logger.error('weeklyRatingAggregation.alertFailed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      logger.warn('weeklyRatingAggregation.alertSkipped', {
        reason: 'ONCALL_EMAIL not set',
        lowCount: lowRatingRows.length,
      });
    }
  }

  return {
    checked: rows.length,
    alerted,
    period: { days: LOOKBACK_DAYS, since: since.toISOString() },
  };
}
