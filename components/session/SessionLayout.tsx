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
import type { SessionView, PhaseContent } from '@/lib/session/sessionEngine';

interface SessionLayoutProps {
  session: SessionView;
  phase: PhaseContent;
  children: React.ReactNode;
}

export function SessionLayout({ session, phase, children }: SessionLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <SessionHeader session={session} phase={phase} />
      <main className="pb-6">{children}</main>
    </div>
  );
}

export default SessionLayout;
