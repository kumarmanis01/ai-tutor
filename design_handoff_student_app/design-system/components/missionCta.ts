/**
 * Mission CTA helper — single source of truth for "what does the action
 * button on a mission/topic card say and look like?"
 *
 * INSTALL AT: lib/learning/missionCta.ts
 *
 * Use everywhere a mission/topic CTA renders. Never hard-code "Start homework"
 * per surface — the label and variant come from the mission's state.
 *
 * Adapt the Mission / MissionKind / MissionState types to your existing
 * lib/types definitions. Add only the states this helper switches on.
 */

export type MissionKind = 'Lesson' | 'Homework' | 'Practice' | 'Quiz' | 'Project';

export type MissionState =
  | 'not_started'
  | 'in_progress'
  | 'completed_today'
  | 'available_tomorrow'
  | 'failed_retry'
  | 'recommended_new';

export type MissionCtaVariant = 'primary' | 'amber' | 'ghost' | 'disabled';

export interface MissionCtaResult {
  label: string;
  variant: MissionCtaVariant;
  icon?: 'arrow' | 'play' | 'check' | 'lock';
}

export function missionCta(m: { kind: MissionKind; state: MissionState }): MissionCtaResult {
  // Homeworks get amber to signal urgency. Lessons / practice / quizzes get primary purple.
  const isHomework = m.kind === 'Homework';
  const accent: MissionCtaVariant = isHomework ? 'amber' : 'primary';

  switch (m.state) {
    case 'not_started':
    case 'recommended_new':
      return {
        label: isHomework ? 'Start homework' : 'Start',
        variant: accent,
        icon: 'arrow',
      };

    case 'in_progress':
      return {
        label: isHomework ? 'Continue homework' : 'Continue learning',
        variant: accent,
        icon: 'play',
      };

    case 'completed_today':
      return {
        label: 'Review',
        variant: 'ghost',
        icon: 'check',
      };

    case 'failed_retry':
      return {
        label: 'Retry',
        variant: 'amber',
        icon: 'arrow',
      };

    case 'available_tomorrow':
      return {
        label: 'Locked',
        variant: 'disabled',
        icon: 'lock',
      };

    default: {
      // Exhaustiveness check: TypeScript will complain if a new MissionState
      // is added without a case here.
      const _exhaustive: never = m.state;
      void _exhaustive;
      return { label: 'Open', variant: accent, icon: 'arrow' };
    }
  }
}
