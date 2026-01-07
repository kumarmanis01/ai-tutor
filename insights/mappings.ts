export type AnalyticsSignal = {
  id: string
  type: string
  courseId?: string
  targetId?: string
  payload?: Record<string, any>
  metadata?: Record<string, any>
  createdAt?: string
}

export type ContentSuggestionInput = {
  courseId: string
  scope: 'COURSE' | 'MODULE' | 'LESSON' | 'QUIZ'
  targetId: string
  type: 'LOW_COMPLETION' | 'HIGH_RETRY' | 'DROP_OFF' | 'LOW_ENGAGEMENT' | 'CONTENT_CLARITY'
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  message: string
  evidenceJson: any
}

export function mapSignalToSuggestions(signal: AnalyticsSignal): ContentSuggestionInput[] {
  switch (signal.type) {
    case 'LOW_COMPLETION': {
      const targetId = signal.targetId || 'unknown'
      return [{
        courseId: signal.courseId || '',
        scope: 'LESSON',
        targetId,
        type: 'LOW_COMPLETION',
        severity: 'HIGH',
        message: `Low completion rate detected for lesson ${targetId}`,
        evidenceJson: { signal, hint: 'completionRate < threshold' }
      }]
    }
    case 'HIGH_RETRY': {
      const targetId = signal.targetId || 'unknown'
      return [{
        courseId: signal.courseId || '',
        scope: 'QUIZ',
        targetId,
        type: 'HIGH_RETRY',
        severity: 'MEDIUM',
        message: `High retry rate detected for quiz ${targetId}`,
        evidenceJson: { signal, hint: 'retryRate > threshold' }
      }]
    }
    case 'DROP_OFF': {
      const targetId = signal.targetId || 'unknown'
      return [{
        courseId: signal.courseId || '',
        scope: 'MODULE',
        targetId,
        type: 'DROP_OFF',
        severity: 'MEDIUM',
        message: `High drop-off detected in module ${targetId}`,
        evidenceJson: { signal, hint: 'dropOffSpike' }
      }]
    }
    case 'LOW_ENGAGEMENT': {
      const targetId = signal.targetId || 'unknown'
      return [{
        courseId: signal.courseId || '',
        scope: 'COURSE',
        targetId,
        type: 'LOW_ENGAGEMENT',
        severity: 'LOW',
        message: `Low engagement signal for course ${signal.courseId}`,
        evidenceJson: { signal }
      }]
    }
    case 'CONTENT_CLARITY': {
      const targetId = signal.targetId || 'unknown'
      return [{
        courseId: signal.courseId || '',
        scope: 'LESSON',
        targetId,
        type: 'CONTENT_CLARITY',
        severity: 'MEDIUM',
        message: `Content clarity issue suggested for ${targetId}`,
        evidenceJson: { signal }
      }]
    }
    default:
      throw new Error(`Unknown signal type: ${String(signal.type)}`)
  }
}

export default mapSignalToSuggestions
