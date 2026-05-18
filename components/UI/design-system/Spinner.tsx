/**
 * FILE OBJECTIVE:
 * - Reusable loading spinner primitive using border-primary token.
 *   Replaces all inline spinner divs in auth pages.
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/ENGINEERING_PRACTICES.md
 *
 * EDIT LOG:
 * - 2026-05-18T00:00:00Z | claude | create Spinner primitive for design-system
 */

const SIZE_CLASSES = {
  sm: 'w-5 h-5 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-[3px]',
} as const;

interface SpinnerProps {
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <div
      className={[
        SIZE_CLASSES[size],
        'border-primary border-t-transparent rounded-full animate-spin',
        className,
      ].join(' ')}
      role="status"
      aria-label="Loading"
    />
  );
}
