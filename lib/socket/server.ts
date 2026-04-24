/**
 * FILE OBJECTIVE:
 * - Socket.IO server singleton. Attaches to the Next.js HTTP server, validates
 *   JWT on connection, organises clients into typed rooms, and emits real-time
 *   events for consent, premium, content generation, badges, and assignments.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/socket/server.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created — B5.1 Socket.IO server
 */

import { Server as SocketIOServer, type Socket } from 'socket.io'
import type { Server as HTTPServer } from 'http'
import { verifyUserAccessToken } from '@/lib/auth/token.service'
import { isBlacklisted } from '@/lib/auth/blacklist.service'
import { logger } from '@/lib/logger'
import {
  rooms,
  type ServerToClientEvents,
  type ClientToServerEvents,
  type InterServerEvents,
  type SocketData,
} from './event-bus'

// ── Types ─────────────────────────────────────────────────────────────────────

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
type AppIO = SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>

// ── Singleton ─────────────────────────────────────────────────────────────────

let _io: AppIO | null = null

/**
 * Attach (or return existing) Socket.IO server to the HTTP server.
 * Safe to call multiple times — only initialises once.
 */
export function initSocketIO(httpServer: HTTPServer): AppIO {
  if (_io) return _io

  _io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      path: '/api/socket',
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    },
  )

  // ── JWT authentication middleware ─────────────────────────────────────────

  _io.use(async (socket: AppSocket, next) => {
    const token =
      socket.handshake.auth?.token as string | undefined ??
      socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      logger.warn('Socket.IO: connection rejected — no token', { socketId: socket.id })
      return next(new Error('Authentication required'))
    }

    try {
      const payload = await verifyUserAccessToken(token)

      // Check blacklist (logged-out tokens)
      const revoked = await isBlacklisted(payload.jti)
      if (revoked) {
        logger.warn('Socket.IO: connection rejected — blacklisted token', { socketId: socket.id })
        return next(new Error('Token has been revoked'))
      }

      // Attach user data to socket
      socket.data.userId = payload.sub
      socket.data.role = payload.role
      socket.data.scope = payload.scope

      next()
    } catch {
      logger.warn('Socket.IO: connection rejected — invalid token', { socketId: socket.id })
      next(new Error('Invalid or expired token'))
    }
  })

  // ── Connection handler ────────────────────────────────────────────────────

  _io.on('connection', (socket: AppSocket) => {
    const { userId } = socket.data
    logger.info('Socket.IO: client connected', { userId, socketId: socket.id })

    // Auto-join personal user room
    void socket.join(rooms.user(userId))

    // Handle consent room join request
    socket.on('join_consent_room', (consentToken: string) => {
      // Validate token format (alphanumeric, reasonable length)
      if (typeof consentToken !== 'string' || consentToken.length > 200) return
      void socket.join(rooms.consent(consentToken))
    })

    socket.on('leave_consent_room', (consentToken: string) => {
      if (typeof consentToken !== 'string' || consentToken.length > 200) return
      void socket.leave(rooms.consent(consentToken))
    })

    socket.on('disconnect', (reason) => {
      logger.info('Socket.IO: client disconnected', { userId, socketId: socket.id, reason })
    })

    socket.on('error', (err) => {
      logger.error('Socket.IO: socket error', { userId, socketId: socket.id, error: err })
    })
  })

  logger.info('Socket.IO server initialized')
  return _io
}

/**
 * Get the singleton Socket.IO instance.
 * Returns null if initSocketIO has not been called yet.
 */
export function getIO(): AppIO | null {
  return _io
}

// ── Typed emitter helpers ─────────────────────────────────────────────────────

/**
 * Emit consent_approved to the consent room.
 */
export function emitConsentApproved(
  consentToken: string,
  studentId: string,
  parentName?: string,
): void {
  _io?.to(rooms.consent(consentToken)).emit('consent_approved', { consentToken, studentId, parentName })
}

/**
 * Emit consent_denied to the consent room.
 */
export function emitConsentDenied(consentToken: string, studentId: string): void {
  _io?.to(rooms.consent(consentToken)).emit('consent_denied', { consentToken, studentId })
}

/**
 * Emit consent_expired to the consent room.
 */
export function emitConsentExpired(consentToken: string, studentId: string): void {
  _io?.to(rooms.consent(consentToken)).emit('consent_expired', { consentToken, studentId })
}

/**
 * Emit premium_activated to the student room.
 */
export function emitPremiumActivated(
  studentId: string,
  plan: string,
  expiresAt: string,
): void {
  _io?.to(rooms.student(studentId)).emit('premium_activated', { plan, expiresAt })
}

/**
 * Emit content_generated to the student room.
 */
export function emitContentGenerated(
  studentId: string,
  contentId: string,
  topic: string,
): void {
  _io?.to(rooms.student(studentId)).emit('content_generated', { contentId, topic })
}

/**
 * Emit new_badge to the user room.
 */
export function emitNewBadge(
  userId: string,
  badgeId: string,
  badgeName: string,
  badgeIcon: string,
): void {
  _io?.to(rooms.user(userId)).emit('new_badge', { badgeId, badgeName, badgeIcon })
}

/**
 * Emit assignment_received to the student room.
 */
export function emitAssignmentReceived(
  studentId: string,
  payload: { assignmentId: string; title: string; dueDate?: string; subject?: string },
): void {
  _io?.to(rooms.student(studentId)).emit('assignment_received', payload)
}

/**
 * Emit assignment_completed to the parent's user room.
 */
export function emitAssignmentCompleted(
  parentId: string,
  payload: { assignmentId: string; childName: string; score?: number },
): void {
  _io?.to(rooms.user(parentId)).emit('assignment_completed', payload)
}
