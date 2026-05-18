/**
 * Pill — small status / category tag.
 *
 * Intent drives the color. Use semantically:
 *   - amber    — pending / urgent / homework
 *   - mint     — success / done / strong
 *   - critical — critical / failing
 *   - primary  — neutral brand-tinted (e.g. "Showing 3 badges")
 *   - ghost    — quiet meta (e.g. "Due tomorrow")
 *
 * ReadinessPill is a specialized wrapper: pass a tier and it picks the right
 * intent + label automatically. Use that anywhere a readiness state shows up.
 */
import { ReactNode } from 'react';
import { READINESS_STYLE, ReadinessTier } from '@/lib/learning/readinessTiers';

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

/**
 * ReadinessPill — single source of truth for "how ready is this subject/chapter".
 * Reads the tier word ('Critical' / 'Weak' / 'Fair' / 'On track' / 'Strong'),
 * never the numeric %.  Honors the CLAUDE rule.
 */
export function ReadinessPill({ tier, className = '' }: { tier: ReadinessTier; className?: string }) {
  const TIER_INTENT: Record<ReadinessTier, Intent> = {
    'critical':  'critical',
    'weak':      'critical',
    'fair':      'amber',
    'on track':  'primary',
    'strong':    'mint',
  };
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);
  return (
    <Pill intent={TIER_INTENT[tier]} className={className}>
      {label}
    </Pill>
  );
}
