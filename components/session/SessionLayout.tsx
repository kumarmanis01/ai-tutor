'use client';
/**
 * FILE OBJECTIVE:
 * - Provides the consistent UI frame for every session phase.
 * - SessionHeader (sticky top) + children + optional SessionFooter (sticky bottom).
 * - Per architecture spec: every phase automatically gets the same UX shell.
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

import React from 'react';
import { SessionHeader } from './SessionHeader';
import { SessionFooter } from './SessionFooter';
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';

export interface SessionLayoutFooterConfig {
  nextLabel: string;
  onNext: () => void;
  nextDisabled?: boolean;
  loading?: boolean;
  showPrevious?: boolean;
  onPrevious?: () => void;
}

interface SessionLayoutProps {
  session: SessionView;
  phase: PhaseContent;
  children: React.ReactNode;
  footer?: SessionLayoutFooterConfig | null;
  /** Called when student clicks a completed step to navigate back. */
  onStepClick?: (phase: string) => void;
}

export function SessionLayout({ session, phase, children, footer, onStepClick }: SessionLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <SessionHeader session={session} phase={phase} onStepClick={onStepClick} />
      <main className={footer ? 'pb-20' : 'pb-6'}>{children}</main>
      {footer && (
        <SessionFooter
          nextLabel={footer.nextLabel}
          onNext={footer.onNext}
          nextDisabled={footer.nextDisabled}
          loading={footer.loading}
          showPrevious={footer.showPrevious}
          onPrevious={footer.onPrevious}
        />
      )}
    </div>
  );
}

export default SessionLayout;
