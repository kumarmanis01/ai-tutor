/**
 * DayDot — single day cell in the weekly streak strip.
 *
 * The 3 px press-down shadow on done/today is what makes the app feel like
 * a habit-forming companion. Keep it.
 *
 * States:
 *   - done    — mint fill, white check, success press-shadow
 *   - today   — white fill, 2 px primary border, primary dot, primary press-shadow
 *   - future  — dashed border, no fill
 *   - missed  — dashed border, faint X (use forward-looking copy elsewhere; never show a "missed!" toast)
 */
import { CheckIcon } from './icons'; // your existing icon set
import { ReactNode } from 'react';

type State = 'done' | 'today' | 'future' | 'missed';

interface DayDotProps {
  state: State;
  className?: string;
  /** Optional label shown beneath (e.g. "M"). Not rendered by DayDot itself — wrap externally. */
  ariaLabel?: string;
}

const stateClasses: Record<State, string> = {
  done:
    'bg-success text-white shadow-press-success',
  today:
    'bg-card text-primary border-2 border-primary shadow-press-primary',
  future:
    'bg-transparent text-transparent border-2 border-dashed border-border',
  missed:
    'bg-transparent text-ink-4 border-2 border-dashed border-border',
};

export function DayDot({ state, className = '', ariaLabel }: DayDotProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? state}
      className={[
        'w-8 h-8 rounded-full inline-flex items-center justify-center',
        'text-xs font-medium',
        stateClasses[state],
        className,
      ].filter(Boolean).join(' ')}
    >
      {state === 'done'   && <CheckIcon className="w-4 h-4" />}
      {state === 'today'  && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
      {state === 'missed' && <span aria-hidden>·</span>}
    </div>
  );
}
