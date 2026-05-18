import { ReactNode } from 'react';
import { ReadinessTier } from '@/lib/learning/readinessTiers';

type Intent = 'amber' | 'mint' | 'critical' | 'primary' | 'ghost';

interface PillProps {
  intent?: Intent;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

const intentClasses: Record<Intent, string> = {
  amber:    'bg-warning-bg text-warning',
  mint:     'bg-success-bg text-success',
  critical: 'bg-error-bg text-error',
  primary:  'bg-primary-bg text-primary',
  ghost:    'bg-transparent text-muted-foreground border border-border',
};

/** Small status / category tag. intent drives color -- never invent per-screen pill styles. */
export function Pill({ intent = 'ghost', leftIcon, rightIcon, className = '', children }: PillProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'text-xs font-medium leading-none whitespace-nowrap',
        intentClasses[intent],
        className,
      ].filter(Boolean).join(' ')}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </span>
  );
}

const TIER_INTENT: Record<ReadinessTier, Intent> = {
  'critical':  'critical',
  'weak':      'critical',
  'fair':      'amber',
  'on track':  'primary',
  'strong':    'mint',
};

/** Specialized Pill for readiness tier. Renders tier label, never numeric %. */
export function ReadinessPill({ tier, className = '' }: { tier: ReadinessTier; className?: string }) {
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return (
    <Pill intent={TIER_INTENT[tier]} className={className}>
      {label}
    </Pill>
  );
}
