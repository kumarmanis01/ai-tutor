import { ReactNode, CSSProperties } from 'react';

type Size = 'sm' | 'md' | 'lg';

interface RingProps {
  percent: number;
  size?: Size;
  colorVar?: string;
  thicknessPx?: number;
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

const SIZE_PX: Record<Size, number> = { sm: 48, md: 56, lg: 64 };

/**
 * Conic-gradient progress ring. Pure presentational.
 * Pass colorVar as a CSS variable name (e.g. '--color-primary').
 * Never put a raw percentage as the user-facing label -- use the tier word.
 */
export function Ring({
  percent,
  size = 'md',
  colorVar = '--color-primary',
  thicknessPx = 6,
  children,
  className = '',
  ariaLabel,
}: RingProps) {
  const px = SIZE_PX[size];
  const clamped = Math.max(0, Math.min(100, percent));
  const style = {
    width: px,
    height: px,
    '--ring-percent': String(clamped),
    '--ring-color': `var(${colorVar})`,
    '--ring-thickness': `${thicknessPx}px`,
  } as CSSProperties;

  return (
    <div
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      className={['ds-ring', className].filter(Boolean).join(' ')}
      style={style}
    >
      <div className="text-sm font-medium text-foreground tabular-nums">
        {children}
      </div>
    </div>
  );
}
