/**
 * Button — single source of CTA variants for the student app.
 *
 * Variants:
 *   - primary  — main CTA (purple)
 *   - amber    — urgent / homework / retry
 *   - ghost    — secondary action
 *   - danger   — destructive (delete, sign-out-from-sensitive)
 *   - disabled — visually disabled
 *
 * For mission/topic CTAs, derive variant + label from missionCta(mission) —
 * see lib/learning/missionCta.ts. Never hard-code "Start homework" per surface.
 *
 * USAGE:
 *   <Button variant="primary" onClick={start}>Start lesson</Button>
 *   <Button variant="amber" leftIcon={<ArrowIcon />}>{cta.label}</Button>
 */
import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'amber' | 'ghost' | 'danger' | 'disabled';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground shadow-press-primary ' +
    'hover:bg-primary-hover hover:-translate-y-px ' +
    'active:translate-y-px active:shadow-none',
  amber:
    'bg-warning text-white shadow-press-warning ' +
    'hover:-translate-y-px ' +
    'active:translate-y-px active:shadow-none',
  ghost:
    'bg-transparent text-foreground border border-border ' +
    'hover:bg-surface-sunk',
  danger:
    'bg-transparent text-error border border-error/30 ' +
    'hover:bg-error-bg',
  disabled:
    'bg-muted text-muted-foreground cursor-not-allowed opacity-70',
};

const sizeClasses: Record<Size, string> = {
  // Every size respects min-h-[44px] for touch.
  sm: 'min-h-[44px] px-3 py-2 text-xs gap-1.5',
  md: 'min-h-[44px] px-4 py-2.5 text-sm gap-2',
  lg: 'min-h-[52px] px-5 py-3 text-sm gap-2 font-semibold',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leftIcon,
    rightIcon,
    fullWidth,
    className = '',
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || variant === 'disabled';
  const v = isDisabled ? 'disabled' : variant;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center',
        'rounded-lg font-medium leading-none whitespace-nowrap',
        'transition-[transform,background-color,box-shadow] duration-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        variantClasses[v],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
});
