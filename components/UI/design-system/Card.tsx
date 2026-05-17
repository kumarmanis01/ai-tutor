import { HTMLAttributes, ReactNode } from 'react';

type Variant = 'default' | 'warm' | 'hero';
type Padding = 'compact' | 'normal' | 'hero';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  padding?: Padding;
  as?: 'div' | 'section' | 'article' | 'aside';
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-card border border-border rounded-xl',
  warm:    'bg-surface-warm border border-border rounded-xl',
  hero:
    'border border-border rounded-2xl relative overflow-hidden ' +
    'bg-[linear-gradient(135deg,#FBEFD8_0%,#EEEDFE_60%,var(--color-surface-warm)_100%)] ' +
    'dark:bg-[linear-gradient(135deg,#2A1F40_0%,#1A1845_60%,var(--color-surface-warm)_100%)]',
};

const paddingClasses: Record<Padding, string> = {
  compact: 'p-4',
  normal:  'p-6',
  hero:    'p-7 sm:p-8',
};

/** Surface wrapper. variant: default (white) | warm (cream) | hero (gradient). */
export function Card({
  variant = 'default',
  padding = 'normal',
  as: Comp = 'div',
  className = '',
  children,
  ...rest
}: CardProps) {
  return (
    <Comp
      className={[variantClasses[variant], paddingClasses[padding], className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </Comp>
  );
}
