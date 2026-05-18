/**
 * Ring — conic-gradient progress ring.
 *
 * Pure presentational. Pass a percent and optionally a CSS-var name for the
 * fill color. Children render in the center.
 *
 * For readiness rings, pass the tier's fill var:
 *   <Ring percent={subject.readiness} colorVar="--color-fair-fill" />
 *
 * IMPORTANT: never put a raw percentage inside as a label in user-facing
 * readiness contexts. Use the tier word. The percentage is a visual only.
 */
import { ReactNode, CSSProperties } from 'react';

type Size = 'sm' | 'md' | 'lg';

interface RingProps {
  percent: number;          // 0–100
  size?: Size;              // sm: 48, md: 56, lg: 64
  colorVar?: string;        // CSS variable name e.g. '--color-primary'
  thicknessPx?: number;     // ring thickness; default 6
  children?: ReactNode;
  className?: string;
  ariaLabel?: string;
}

const SIZE_PX: Record<Size, number> = { sm: 48, md: 56, lg: 64 };

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
  const style: CSSProperties = {
    width: px,
    height: px,
    // Consumed by .ds-ring (see styles/tailwind.css additions)
    ['--ring-percent' as unknown as string]: String(clamped),
    ['--ring-color' as unknown as string]: `var(${colorVar})`,
    ['--ring-thickness' as unknown as string]: `${thicknessPx}px`,
  };

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
