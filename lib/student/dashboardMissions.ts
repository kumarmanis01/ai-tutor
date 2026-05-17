/**
 * Shared types and helpers for the revamped dashboard mission system.
 *
 * missionCta() is the single source of truth for deriving the primary CTA
 * label and visual variant from a mission's kind + state combination.
 * Every mission card (hero, row, warm-up) calls this function.
 */

export type MissionKind = 'Lesson' | 'Homework' | 'Practice' | 'Quiz'

export type MissionState =
  | 'not_started'
  | 'in_progress'
  | 'completed_today'
  | 'available_tomorrow'
  | 'failed_retry'
  | 'recommended_new'
  | 'homework_in_progress'

export interface DashboardMission {
  id: string
  subjectId: string
  subjectName: string
  kind: MissionKind
  title: string
  chapter?: string
  questionCount?: number | null
  estimatedMins: number
  xp: number
  state: MissionState
  priority: boolean
  due?: string
  href: string
}

export interface MissionCtaResult {
  label: string
  variant: 'primary' | 'amber' | 'ghost' | 'disabled'
  icon: boolean
}

export function missionCta(m: DashboardMission): MissionCtaResult {
  if (m.state === 'completed_today') return { label: 'Review', variant: 'ghost', icon: false }
  if (m.state === 'available_tomorrow') return { label: 'Locked', variant: 'disabled', icon: false }
  if (m.state === 'in_progress') return { label: 'Continue learning', variant: 'primary', icon: true }
  if (m.state === 'homework_in_progress') return { label: 'Continue homework', variant: 'amber', icon: true }
  if (m.state === 'failed_retry') return { label: 'Retry', variant: 'amber', icon: true }
  if (m.kind === 'Homework') return { label: 'Start homework', variant: 'amber', icon: true }
  if (m.kind === 'Practice') return { label: 'Start practice', variant: 'primary', icon: true }
  return { label: 'Start', variant: 'primary', icon: true }
}

// Subject colour palette aligned with globals.css CSS variables.
// Used with inline style={{ color, backgroundColor }} for data-driven colouring.
export interface SubjectColors {
  fill: string
  softBg: string
  textHex: string
  borderHex: string
}

const SUBJECT_COLOR_MAP: Record<string, SubjectColors> = {
  mathematics:    { fill: '#534AB7', softBg: '#EEEDFE', textHex: '#3C3489', borderHex: '#AFA9EC' },
  physics:        { fill: '#185FA5', softBg: '#E6F1FB', textHex: '#0C447C', borderHex: '#85B7EB' },
  chemistry:      { fill: '#BA7517', softBg: '#FAEEDA', textHex: '#633806', borderHex: '#EF9F27' },
  biology:        { fill: '#3B6D11', softBg: '#EAF3DE', textHex: '#27500A', borderHex: '#97C459' },
  english:        { fill: '#D4537E', softBg: '#FBEAF0', textHex: '#72243E', borderHex: '#ED93B1' },
  social:         { fill: '#1D9E75', softBg: '#E1F5EE', textHex: '#085041', borderHex: '#5DCAA5' },
  social_science: { fill: '#1D9E75', softBg: '#E1F5EE', textHex: '#085041', borderHex: '#5DCAA5' },
  hindi:          { fill: '#7C3AED', softBg: '#EDE9FE', textHex: '#4C1D95', borderHex: '#C4B5FD' },
}

const DEFAULT_COLORS: SubjectColors = {
  fill: '#534AB7',
  softBg: '#EEEDFE',
  textHex: '#3C3489',
  borderHex: '#AFA9EC',
}

export function getSubjectColors(subjectId: string): SubjectColors {
  return SUBJECT_COLOR_MAP[subjectId.toLowerCase()] ?? DEFAULT_COLORS
}
