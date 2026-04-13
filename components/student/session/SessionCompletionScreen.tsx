'use client';

/**
 * SessionCompletionScreen -- v2
 *
 * Full-screen scrollable celebration screen shown after a session ends.
 * Layout (top → bottom):
 *   1. Celebration header -- confetti burst, 'Session complete!', topic · duration
 *   2. XP section -- circle badge, +N XP, animated progress bar (easeOut 800ms)
 *   3. Level-up overlay (leveledUp=true) -- min 1.5s, auto-dismiss 3s, tap to dismiss
 *   4. Stats row -- 4 chips: attempted | % correct | hints | minutes
 *   5. Mastery delta -- per concept (single from API; max 5 in future)
 *   6. AI insight card -- 3s skeleton then text
 *   7. Inline star rating -- POST /api/student/session/[sessionId]/rate
 *   8. CTAs -- primary 'Start next session', secondary 'Back to dashboard'
 *
 * Copy rules: no "broke/missed/failed" -- forward-looking tone.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getProgressPercent } from '@/lib/student/xpLevels'
import { useRouter } from 'next/navigation';

// ── Types ──────────────────────────────────────────────────────────────────────

interface CompletionData {
  xpEarned: number;
  totalXp: number;
  leveledUp: boolean;
  newLevel: number | null;
  masteryDelta: number;
  masteryAfter: number;
  badgesEarned: { name: string; description: string; icon?: string }[];
  aiInsight: string | null;
  sessionDurationMinutes: number;
  correctAnswers: number;
  totalQuestions: number;
}

interface NextAction {
  topicId: string | null;
  topicName: string | null;
}

export interface SessionCompletionScreenProps {
  sessionId: string;
  topicName: string;
  /** Number of hints the student used (from AI tutor session). Replaces '--' in stats row. */
  hintsUsed?: number;
  sessionSummary?: {
    tag: string;
    stage: string;
    turnNumber: number;
    hintsUsed?: number;
  };
  onNext?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// ── CSS Confetti (pure CSS keyframes via style tag) ───────────────────────────

const CONFETTI_STYLE = `
@keyframes confetti-fall {
  0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(80px) rotate(720deg); opacity: 0; }
}
.confetti-piece {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 2px;
  animation: confetti-fall 1.2s ease-out forwards;
}
@keyframes levelup-pop {
  0%   { transform: scale(0.7); opacity: 0; }
  60%  { transform: scale(1.08); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.levelup-pop {
  animation: levelup-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
`;

const CONFETTI_COLORS = ['#534AB7', '#1D9E75', '#BA7517', '#E24B4A', '#F5C842', '#60A5FA'];
const CONFETTI_PIECES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  left: `${(i / 18) * 100}%`,
  delay: `${(i % 6) * 0.12}s`,
  size: i % 3 === 0 ? 10 : 7,
}));

// ── Badge icon map (icon key → emoji) ─────────────────────────────────────────

const BADGE_EMOJI: Record<string, string> = {
  fire:      '🔥',
  trophy:    '🏆',
  diamond:   '💎',
  crown:     '👑',
  lightning: '⚡',
  muscle:    '💪',
  star:      '⭐',
}

function badgeEmoji(icon?: string): string {
  if (!icon) return '🏅'
  return BADGE_EMOJI[icon] ?? '🏅'
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConfettiHeader({ topicName, durationMinutes }: { topicName: string; durationMinutes: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#534AB7] to-[#6D63D4] px-5 pt-8 pb-6 text-center text-white">
      {/* Confetti pieces */}
      {CONFETTI_PIECES.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: 0,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
          }}
          aria-hidden
        />
      ))}
      <div className="text-5xl mb-3" aria-hidden>🎉</div>
      <h1 className="text-xl font-bold leading-tight">Session complete!</h1>
      <p className="mt-1 text-sm text-indigo-200">
        {topicName} · {durationMinutes > 0 ? `${durationMinutes} min` : 'just now'}
      </p>
    </div>
  );
}

function XpSection({
  xpEarned,
  totalXp,
}: {
  xpEarned: number;
  totalXp: number;
}) {
  const [displayXp, setDisplayXp] = useState(totalXp - xpEarned);
  const [barWidth, setBarWidth] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const duration = 800;
    const startVal = totalXp - xpEarned;
    // Use centralized level thresholds to compute progress within level bands.
    const prevTotal = Math.max(0, totalXp - xpEarned);
    const startProgress = getProgressPercent(prevTotal);
    const endProgress = getProgressPercent(totalXp);
    const deltaProgress = endProgress - startProgress;

    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      const t = Math.min((ts - startRef.current) / duration, 1);
      const ease = easeOut(t);
      setDisplayXp(Math.round(startVal + xpEarned * ease));
      setBarWidth(Math.min(100, Math.max(0, startProgress + deltaProgress * ease)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [totalXp, xpEarned]);

  return (
    <div className="flex flex-col items-center gap-3 py-2">
      {/* XP circle */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[#534AB7] bg-[#EEEDFE] dark:bg-[#534AB7]/20">
        <div className="text-center">
          <p className="text-lg font-extrabold text-[#534AB7] dark:text-indigo-300 leading-none">
            +{xpEarned}
          </p>
          <p className="text-[10px] font-medium text-[#534AB7]/70 dark:text-indigo-400 uppercase tracking-wide">
            XP
          </p>
        </div>
      </div>
      {/* Counter */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Total XP:{' '}
        <span className="font-semibold text-gray-800 dark:text-gray-100">{displayXp}</span>
      </p>
      {/* Progress bar */}
      <div className="w-full max-w-[280px]">
        <div className="h-2 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#534AB7] transition-none"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function BadgesEarnedSection({
  badges,
}: {
  badges: { name: string; description: string; icon?: string }[];
}) {
  if (badges.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5">
        Badges Earned
      </p>
      <div className="flex flex-col gap-2">
        {badges.map((b) => (
          <div
            key={b.name}
            className="flex items-center gap-3 rounded-xl bg-[#EEEDFE] dark:bg-[#534AB7]/20 px-4 py-3"
          >
            <span className="text-2xl leading-none" aria-hidden>{badgeEmoji(b.icon)}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#534AB7] dark:text-indigo-300 leading-tight truncate">
                {b.name}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-tight truncate">
                {b.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LevelUpOverlay({
  newLevel,
  onDismiss,
}: {
  newLevel: number;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 cursor-pointer"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-label="Level up celebration"
    >
      <div className="levelup-pop text-center px-8">
        <div className="text-6xl mb-4" aria-hidden>⭐</div>
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-300 mb-2">
          Level Up!
        </p>
        <p className="text-6xl font-extrabold text-white mb-3">
          Level {newLevel}
        </p>
        <p className="text-sm text-amber-100 max-w-[260px] mx-auto">
          Your consistent effort is opening new doors. Keep going!
        </p>
        <p className="mt-6 text-xs text-white/50">Tap anywhere to continue</p>
      </div>
    </div>
  );
}

function StatsRow({
  totalQuestions,
  correctAnswers,
  sessionDurationMinutes,
  hintsUsed,
}: {
  totalQuestions: number;
  correctAnswers: number;
  sessionDurationMinutes: number;
  hintsUsed?: number;
}) {
  const pct =
    totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;

  const chips = [
    { label: 'Attempted', value: String(totalQuestions) },
    { label: '% Correct', value: `${pct}%` },
    { label: 'Hints', value: hintsUsed != null ? String(hintsUsed) : '--' },
    { label: 'Minutes', value: sessionDurationMinutes > 0 ? String(sessionDurationMinutes) : '<1' },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {chips.map((c) => (
        <div
          key={c.label}
          className="flex flex-col items-center rounded-xl bg-gray-50 dark:bg-slate-800/60 px-2 py-3 gap-1"
        >
          <span className="text-base font-bold text-gray-900 dark:text-gray-100 leading-none">
            {c.value}
          </span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 text-center leading-tight">
            {c.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function MasteryDelta({
  masteryDelta,
  masteryAfter,
}: {
  masteryDelta: number;
  masteryAfter: number;
}) {
  const deltaPercent = Math.round(masteryDelta * 100);
  const afterPercent = Math.round(masteryAfter * 100);
  const positive = deltaPercent >= 0;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2.5">
        Mastery
      </p>
      <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-slate-800/60 px-4 py-3">
        <span className="text-sm text-gray-700 dark:text-gray-300">This concept</span>
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold ${
              positive
                ? 'text-[#1D9E75] dark:text-green-400'
                : 'text-[#E24B4A] dark:text-red-400'
            }`}
          >
            {positive ? '+' : ''}{deltaPercent}%
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            → {afterPercent}%
          </span>
        </div>
      </div>
    </div>
  );
}

function AiInsightCard({ insight }: { insight: string | null }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  const text =
    insight && insight.trim() ? insight : 'Great work this session -- your consistency is building strong foundations!';

  return (
    <div className="rounded-xl border border-[#EEEDFE] dark:border-[#534AB7]/30 bg-[#EEEDFE]/50 dark:bg-[#534AB7]/10 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm" aria-hidden>💡</span>
        <p className="text-xs font-semibold text-[#534AB7] dark:text-indigo-300 uppercase tracking-wide">
          Teacher Vidya's insight
        </p>
      </div>
      {!visible ? (
        <div className="space-y-2" aria-label="Loading insight">
          <div className="h-3 w-10/12 rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 animate-pulse" />
          <div className="h-3 w-9/12 rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 animate-pulse" />
          <div className="h-3 w-7/12 rounded-full bg-[#534AB7]/10 dark:bg-[#534AB7]/20 animate-pulse" />
        </div>
      ) : (
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {text}
        </p>
      )}
    </div>
  );
}

function StarRating({ sessionId }: { sessionId: string }) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const submitRating = useCallback(
    async (rating: number) => {
      if (submitted) return;
      setSelected(rating);
      setSubmitted(true);
      try {
        await fetch(`/api/student/session/${encodeURIComponent(sessionId)}/rate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating }),
        });
      } catch {
        // best-effort; rating is non-critical
      }
    },
    [sessionId, submitted],
  );

  if (submitted) {
    return (
      <div className="text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500">Thanks for your feedback!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-xs text-gray-500 dark:text-gray-400">How was this session?</p>
      <div className="flex items-center gap-1" role="group" aria-label="Rate this session">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= (hovered || selected);
          return (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star !== 1 ? 's' : ''}`}
              className="text-2xl min-w-[44px] min-h-[44px] flex items-center justify-center transition-transform active:scale-90"
              onClick={() => void submitRating(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
            >
              {filled ? '⭐' : '☆'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export const SessionCompletionScreen: React.FC<SessionCompletionScreenProps> = ({
  sessionId,
  topicName,
  hintsUsed,
  onNext,
}) => {
  const router = useRouter();
  const [data, setData] = useState<CompletionData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [showLevelOverlay, setShowLevelOverlay] = useState(false);
  const [levelOverlayDone, setLevelOverlayDone] = useState(false);
  const [nextAction, setNextAction] = useState<NextAction | null>(null);

  // Fetch completion data
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/student/session/${encodeURIComponent(sessionId)}/complete`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          },
        );
        const json = (await res.json().catch(() => null)) as CompletionData | null;
        if (!cancelled && json) {
          setData(json);
        } else if (!cancelled) {
          setFetchError(true);
        }
      } catch {
        if (!cancelled) setFetchError(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Fetch next action in parallel
  useEffect(() => {
    fetch('/api/home/next-action')
      .then((r) => r.json())
      .then((body) => {
        const action = body?.action;
        if (action?.topicId) {
          setNextAction({ topicId: action.topicId, topicName: action.topicName ?? null });
        }
      })
      .catch(() => {});
  }, []);

  // Level-up overlay -- show for 3s, dismiss via timer or tap; mark done when overlay goes away
  useEffect(() => {
    if (!data) return;
    if (!data.leveledUp) {
      setLevelOverlayDone(true);
      return;
    }
    setShowLevelOverlay(true);
    const t = setTimeout(() => {
      setShowLevelOverlay(false);
      setLevelOverlayDone(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [data]);

  const dismissLevelOverlay = useCallback(() => {
    setShowLevelOverlay(false);
    setLevelOverlayDone(true);
  }, []);

  function handleStartNext() {
    if (onNext) {
      onNext();
      return;
    }
    if (nextAction?.topicId) {
      // Route through pre-session screen so hook prefetch and prereq check run.
      router.push(`/session/pre/${encodeURIComponent(nextAction.topicId)}`);
    }
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (!data && !fetchError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-48 rounded-full bg-gray-200 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-32 rounded-full bg-gray-200 dark:bg-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Fallback on error ─────────────────────────────────────────────────────

  const d: CompletionData = data ?? {
    xpEarned: 0,
    totalXp: 0,
    leveledUp: false,
    newLevel: null,
    masteryDelta: 0,
    masteryAfter: 0,
    badgesEarned: [],
    aiInsight: null,
    sessionDurationMinutes: 0,
    correctAnswers: 0,
    totalQuestions: 0,
  };

  return (
    <>
      {/* Inject keyframes */}
      <style>{CONFETTI_STYLE}</style>

      {/* Level-up overlay -- rendered above everything */}
      {showLevelOverlay && d.leveledUp && d.newLevel != null && (
        <LevelUpOverlay newLevel={d.newLevel} onDismiss={dismissLevelOverlay} />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center px-4 py-8">
        <div className="w-full max-w-[480px] flex flex-col gap-5">

          {/* 1. Celebration header */}
          <ConfettiHeader
            topicName={topicName}
            durationMinutes={d.sessionDurationMinutes}
          />

          {/* 2. XP section */}
          <XpSection xpEarned={d.xpEarned} totalXp={d.totalXp} />

          {/* 3. Badges earned this session */}
          {d.badgesEarned.length > 0 && (
            <BadgesEarnedSection badges={d.badgesEarned} />
          )}

          {/* Divider */}
          <div className="h-px bg-gray-200 dark:bg-slate-800" />

          {/* 4. Stats row */}
          <StatsRow
            totalQuestions={d.totalQuestions}
            correctAnswers={d.correctAnswers}
            sessionDurationMinutes={d.sessionDurationMinutes}
            hintsUsed={hintsUsed}
          />

          {/* 5. Mastery delta */}
          {(d.masteryDelta !== 0 || d.masteryAfter > 0) && (
            <MasteryDelta masteryDelta={d.masteryDelta} masteryAfter={d.masteryAfter} />
          )}

          {/* 6. AI insight card */}
          <AiInsightCard insight={d.aiInsight} />

          {/* 7. Star rating */}
          <StarRating sessionId={sessionId} />

          {/* 8. CTAs */}
          <div className="flex flex-col gap-3 mt-1">
            <button
              type="button"
              onClick={handleStartNext}
              disabled={!levelOverlayDone}
              className="flex w-full min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#534AB7] text-white text-sm font-semibold hover:bg-[#4840a3] active:scale-[0.98] disabled:opacity-60 transition-all shadow-md shadow-[#534AB7]/25"
            >
              {nextAction?.topicName
                ? `Start: ${nextAction.topicName} →`
                : 'Start next session →'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="flex w-full min-h-[52px] items-center justify-center rounded-xl border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              Back to dashboard
            </button>
          </div>

        </div>
      </div>
    </>
  );
};

export default SessionCompletionScreen;
