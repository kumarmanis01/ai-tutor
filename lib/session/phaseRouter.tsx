'use client';
/**
 * FILE OBJECTIVE:
 * - Maps SessionPhase → the correct React component to render.
 * - Single place to add new phases without touching SessionContainer.
 * - Per architecture spec: "This keeps the container clean."
 *
 * EDIT LOG:
 * - 2026-03-08 | claude | created for Session Architecture refactor
 */

import type { ComponentType } from 'react';
import type { SessionPhaseClient } from '@/lib/session/phaseConfig';
import { OverviewPhase } from '@/components/session/phases/OverviewPhase';
import { ExplanationPhase } from '@/components/session/phases/ExplanationPhase';
import { PracticePhase } from '@/components/session/phases/PracticePhase';
import { TestPhase } from '@/components/session/phases/TestPhase';
import { HomeworkPhase } from '@/components/session/phases/HomeworkPhase';

// Each entry is typed as ComponentType<any> so phaseRouter is usable without
// needing to unify all phase prop types into a single interface.
// SessionContainer narrows the type before rendering.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPhaseComponent = ComponentType<any>;

const PHASE_COMPONENT_MAP: Partial<Record<SessionPhaseClient, AnyPhaseComponent>> = {
  OVERVIEW: OverviewPhase,
  EXPLANATION: ExplanationPhase,
  PRACTICE: PracticePhase,
  TEST: TestPhase,
  HOMEWORK: HomeworkPhase,
};

/**
 * Returns the React component for a given session phase, or null for
 * terminal states (COMPLETE, EXPIRED) which are handled by SessionContainer.
 */
export function phaseRouter(phase: SessionPhaseClient): AnyPhaseComponent | null {
  return PHASE_COMPONENT_MAP[phase] ?? null;
}
