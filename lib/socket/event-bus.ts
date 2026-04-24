/**
 * FILE OBJECTIVE:
 * - Typed event bus for Socket.IO real-time events. Defines all event types
 *   and their payloads for type-safe emission across the application.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/socket/event-bus.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B5.1 Socket.IO event bus types
 */

// ── Event payload types ───────────────────────────────────────────────────────

export interface ConsentApprovedPayload {
  consentToken: string
  studentId: string
  parentName?: string
}

export interface ConsentDeniedPayload {
  consentToken: string
  studentId: string
}

export interface ConsentExpiredPayload {
  consentToken: string
  studentId: string
}

export interface PremiumActivatedPayload {
  plan: string
  expiresAt: string
}

export interface ContentGeneratedPayload {
  contentId: string
  topic: string
}

export interface NewBadgePayload {
  badgeId: string
  badgeName: string
  badgeIcon: string
}

export interface AssignmentReceivedPayload {
  assignmentId: string
  title: string
  dueDate?: string
  subject?: string
}

export interface AssignmentCompletedPayload {
  assignmentId: string
  childName: string
  score?: number
}

// ── Server → Client events (typed) ───────────────────────────────────────────

export interface ServerToClientEvents {
  consent_approved: (payload: ConsentApprovedPayload) => void
  consent_denied: (payload: ConsentDeniedPayload) => void
  consent_expired: (payload: ConsentExpiredPayload) => void
  premium_activated: (payload: PremiumActivatedPayload) => void
  content_generated: (payload: ContentGeneratedPayload) => void
  new_badge: (payload: NewBadgePayload) => void
  assignment_received: (payload: AssignmentReceivedPayload) => void
  assignment_completed: (payload: AssignmentCompletedPayload) => void
}

// ── Client → Server events ────────────────────────────────────────────────────

export interface ClientToServerEvents {
  /** Client requests to join a consent-specific room */
  join_consent_room: (consentToken: string) => void
  /** Client leaves a consent room after resolution */
  leave_consent_room: (consentToken: string) => void
}

// ── Inter-server events (for Socket.IO adapter scaling) ──────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Reserved for future Redis adapter scaling
export interface InterServerEvents {}

// ── Socket data ───────────────────────────────────────────────────────────────

export interface SocketData {
  userId: string
  role: string
  scope: 'user' | 'admin'
}

// ── Room naming helpers ───────────────────────────────────────────────────────

export const rooms = {
  user: (userId: string) => `user:${userId}`,
  student: (profileId: string) => `student:${profileId}`,
  consent: (consentToken: string) => `consent:${consentToken}`,
} as const
