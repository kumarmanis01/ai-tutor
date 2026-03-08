'use client';

import React, { useEffect, useState } from 'react';
import { DailyGoalCard } from './DailyGoalCard';
import { StreakIndicator } from './StreakIndicator';
import { WeeklyActivityCalendar } from './WeeklyActivityCalendar';
import type { DailyGoalState } from './DailyGoalCard';

interface TodayGoal {
  state: DailyGoalState;
  completedAt?: string;
}

interface Streak {
  current: number;
  longest: number;
}

interface WeeklyDay {
  date: string;
  completed: boolean;
}

interface EngagementPayload {
  today?: TodayGoal;
  streak?: Streak;
  weekly?: WeeklyDay[];
}

const FALLBACK_TODAY: TodayGoal = { state: 'NOT_STARTED' };
const FALLBACK_STREAK: Streak = { current: 0, longest: 0 };
const FALLBACK_WEEKLY: WeeklyDay[] = [];

function parseCombined(data: unknown): EngagementPayload | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  return {
    today: o.today && typeof o.today === 'object' && 'state' in o.today ? (o.today as TodayGoal) : undefined,
    streak: o.streak && typeof o.streak === 'object' && typeof (o.streak as Streak).current === 'number' ? (o.streak as Streak) : undefined,
    weekly: Array.isArray(o.weekly) ? (o.weekly as WeeklyDay[]) : undefined,
  };
}

interface EngagementSectionProps {
  /** When set, "Start Today's Session" links to /session/[topicId]. */
  nextTopicId?: string | null;
}

/**
 * Fetches GET /api/engagement (combined) and renders DailyGoalCard, StreakIndicator, WeeklyActivityCalendar.
 * On error or non-OK response, uses safe fallbacks so the dashboard never breaks.
 */
export function EngagementSection({ nextTopicId }: EngagementSectionProps) {
  const [today, setToday] = useState<TodayGoal | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [weekly, setWeekly] = useState<WeeklyDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/engagement')
      .then((res) => {
        if (cancelled) return null;
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const parsed = parseCombined(data);
        if (parsed) {
          if (parsed.today) setToday(parsed.today);
          else setToday(FALLBACK_TODAY);
          if (parsed.streak) setStreak(parsed.streak);
          else setStreak(FALLBACK_STREAK);
          if (parsed.weekly != null) setWeekly(parsed.weekly);
          else setWeekly(FALLBACK_WEEKLY);
        } else {
          setToday(FALLBACK_TODAY);
          setStreak(FALLBACK_STREAK);
          setWeekly(FALLBACK_WEEKLY);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setToday(FALLBACK_TODAY);
          setStreak(FALLBACK_STREAK);
          setWeekly(FALLBACK_WEEKLY);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const todayState = today?.state ?? 'NOT_STARTED';

  return (
    <section aria-label="Daily learning habit" className="space-y-4">
      <DailyGoalCard
        state={todayState}
        nextTopicId={nextTopicId}
        loading={loading}
      />
      <StreakIndicator current={streak?.current ?? 0} loading={loading} />
      <WeeklyActivityCalendar days={weekly} loading={loading} />
    </section>
  );
}
