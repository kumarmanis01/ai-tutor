/**
 * Daily Learning Habit: engagement service and types.
 */

export {
  getTodayCompletion,
  getCurrentStreak,
  getWeeklyActivity,
  recordSessionCompletion,
  LEARNING_POINTS_PER_SESSION,
} from './engagementService';
export type { TodayCompletion, WeeklyDay, DailyGoalState } from './engagementService';
export { getUniqueStudyDays, computeStreakFromStudyDays, countCompletionsInRange } from './engagementQueries';
export { getLocalDateString, getTodayLocalDateString, startOfLocalDayUtc, endOfLocalDayUtc } from './timezone';
