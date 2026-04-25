/**
 * Nudge Message Utility
 *
 * Returns a single in-app nudge message (or null) based on the student's
 * current engagement state. Only ONE nudge is shown at a time, using the
 * priority order below.
 *
 * Priority:
 *   1. Absent 2+ days                → return-to-platform message
 *   2. Pending homework + absent 1d  → homework urgency
 *   3. Mid-week goal at risk         → goal nudge
 *   4. Unit just completed           → celebration
 *
 * The caller is responsible for rendering (NudgeBanner component).
 * This function is pure -- no side-effects, no DB calls.
 *
 * Tone rules (from UX spec):
 *   - No exclamation marks
 *   - No urgency language
 *   - No punitive framing
 *   - Calm, tutor-like voice
 *
 * EDIT LOG:
 *   2026-03-07 | UX implementation | created per UX architecture blueprint
 */

export interface NudgeContext {
  daysSinceLastSession: number; // 0 = today, 1 = yesterday, etc.
  lastSessionDate: Date | null; // null for users who have never had a session
  pendingHomeworkCount: number;
  sessionsThisWeek: number;
  weeklyGoalSessions: number; // student's chosen weekly goal
  daysLeftInWeek: number; // 1-7, Mon=7 days, Sun=1 day
  lastCompletedUnitName?: string; // set when a unit was just completed
}

/**
 * Returns a plain-language nudge message, or null if no nudge is appropriate.
 */
export function getNudgeMessage(ctx: NudgeContext): string | null {
  // Never show nudge to users who have never had a session
  if (!ctx.lastSessionDate || ctx.daysSinceLastSession >= 90) {
    return null;
  }

  // Priority 1: Absent 2+ days -- highest priority; bring student back
  if (ctx.daysSinceLastSession >= 2) {
    return "It's been a couple of days. Your tutor is ready when you are.";
  }

  // Priority 2: Pending homework + been away at least a day
  if (ctx.pendingHomeworkCount > 0 && ctx.daysSinceLastSession >= 1) {
    return 'You have unfinished homework. Submit it to move ahead.';
  }

  // Priority 3: Mid-week goal at risk (not enough sessions, few days left)
  const sessionsNeeded = ctx.weeklyGoalSessions - ctx.sessionsThisWeek;
  if (sessionsNeeded > 0 && ctx.daysLeftInWeek <= 2) {
    return `You've done ${ctx.sessionsThisWeek} of ${ctx.weeklyGoalSessions} sessions this week. There's still time.`;
  }

  // Priority 4: Unit completion -- celebratory but calm
  if (ctx.lastCompletedUnitName) {
    return `You've finished the ${ctx.lastCompletedUnitName} unit. Ready for the next one?`;
  }

  return null;
}
