'use client';
/**
 * FILE OBJECTIVE:
 * - Provides the consistent UI frame for every session phase.
 * - SessionHeader (sticky top) + children + optional SessionFooter (sticky above
 *   bottom bar) + SessionBottomBar (fixed at very bottom) + DoubtPanel (slide-up).
 *
 * Layout:
 *   sticky top   : SessionHeader  (~80px)
 *   scroll        : <main> children
 *   sticky bottom : SessionFooter (optional, ~68px, clears SessionBottomBar)
 *   fixed bottom  : SessionBottomBar (64px + safe area)
 *   z-50 overlay  : DoubtPanel slide-up dialog
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 * - 2026-04-22 | redesign | add SessionBottomBar, lift DoubtPanel open state,
 *                           adjust padding-bottom for layered sticky/fixed bottom
 */

import React, { useState } from 'react';
import { SessionHeader } from './SessionHeader';
import { SessionFooter } from './SessionFooter';
import { SessionBottomBar } from './SessionBottomBar';
import { DoubtPanel } from './DoubtPanel';
import { useCurrentUser } from '@/hooks/useCurrentUser';
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

export function SessionLayout({
  session,
  phase,
  children,
  footer,
  onStepClick,
}: SessionLayoutProps) {
  const activePhase = session.currentPhase !== 'COMPLETE' && session.currentPhase !== 'EXPIRED';
  const [isDoubtOpen, setIsDoubtOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();

  // Padding-bottom must clear:
  //   active + footer  : SessionFooter (~68px) + SessionBottomBar (64px) + gap = ~148px
  //   active, no footer: SessionBottomBar (64px) + gap = ~80px
  //   complete/expired : no bottom bars = 24px
  const mainPb = !activePhase ? 'pb-6' : footer ? 'pb-40' : 'pb-24';

  return (
    <div className="min-h-screen bg-background">
      <SessionHeader session={session} phase={phase} onStepClick={onStepClick} />

      <main className={mainPb}>{children}</main>

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
        <>
          <SessionBottomBar
            onAskVidya={() => setIsDoubtOpen(true)}
            sessionId={session.sessionId}
            currentPhase={session.currentPhase}
          />
          <DoubtPanel
            subject={session.subject}
            chapter={session.chapter}
            topicName={session.topicName}
            studentName={currentUser?.name ?? undefined}
            isOpen={isDoubtOpen}
            onClose={() => setIsDoubtOpen(false)}
          />
        </>
      )}
    </div>
  );
}

export default SessionLayout;