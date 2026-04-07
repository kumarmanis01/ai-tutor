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
import { DoubtPanel } from './DoubtPanel';
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
  const activePhase = session.currentPhase !== 'COMPLETE' && session.currentPhase !== 'EXPIRED';

  return (
    <div className="min-h-screen bg-background">
      <SessionHeader session={session} phase={phase} onStepClick={onStepClick} />
      {/* pb-36 when footer present to clear both sticky footer and floating button */}
      <main className={footer ? 'pb-36' : 'pb-24'}>{children}</main>
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
      {activePhase && (
        <DoubtPanel
          subject={session.subject}
          chapter={session.chapter}
          topicName={session.topicName}
        />
      )}
    </div>
  );
}

export default SessionLayout;
