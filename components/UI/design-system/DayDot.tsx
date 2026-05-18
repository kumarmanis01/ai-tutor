import { Check } from 'lucide-react';

type State = 'done' | 'today' | 'future' | 'missed';

interface DayDotProps {
  state: State;
  className?: string;
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

/** Single day cell in the weekly streak strip. The 3px press-shadow on done is intentional. */
export function DayDot({ state, className = '', ariaLabel }: DayDotProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel ?? state}
      className={[
        'w-8 h-8 rounded-full inline-flex items-center justify-center',
        'text-xs font-medium min-h-[44px] min-w-[44px]',
        stateClasses[state],
        className,
      ].filter(Boolean).join(' ')}
    >
      {state === 'done'   && <Check className="w-4 h-4" aria-hidden />}
      {state === 'today'  && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
      {state === 'missed' && <span aria-hidden>x</span>}
    </div>
  );
}
