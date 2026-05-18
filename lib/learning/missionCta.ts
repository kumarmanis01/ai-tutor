export type MissionKind = 'Lesson' | 'Homework' | 'Practice' | 'Quiz' | 'Project';

export type MissionState =
  | 'not_started'
  | 'in_progress'
  | 'completed_today'
  | 'available_tomorrow'
  | 'failed_retry'
  | 'recommended_new'
  | 'homework_in_progress';

export type MissionCtaVariant = 'primary' | 'amber' | 'ghost' | 'disabled';

export interface MissionCtaResult {
  label: string;
  variant: MissionCtaVariant;
  icon?: 'arrow' | 'play' | 'check' | 'lock';
}

export function missionCta(m: { kind: MissionKind; state: MissionState }): MissionCtaResult {
  const isHomework = m.kind === 'Homework';
  const accent: MissionCtaVariant = isHomework ? 'amber' : 'primary';

  switch (m.state) {
    case 'not_started':
    case 'recommended_new':
      return { label: isHomework ? 'Start homework' : 'Start', variant: accent, icon: 'arrow' };
    case 'in_progress':
      return { label: isHomework ? 'Continue homework' : 'Continue learning', variant: accent, icon: 'play' };
    case 'homework_in_progress':
      return { label: 'Continue homework', variant: 'amber', icon: 'play' };
    case 'completed_today':
      return { label: 'Review', variant: 'ghost', icon: 'check' };
    case 'failed_retry':
      return { label: 'Retry', variant: 'amber', icon: 'arrow' };
    case 'available_tomorrow':
      return { label: 'Locked', variant: 'disabled', icon: 'lock' };
    default:
      return { label: 'Open', variant: accent, icon: 'arrow' };
  }
}
