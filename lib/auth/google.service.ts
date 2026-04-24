/**
 * FILE OBJECTIVE:
 * - Google OAuth service. Validates Google ID tokens and finds-or-creates
 *   user accounts for parent sign-in with one tap.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/auth/google.service.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created — B2.2 Google OAuth service
 */

import { OAuth2Client } from 'google-auth-library'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GoogleTokenPayload {
  googleId: string
  email: string
  name: string
  picture?: string
  emailVerified: boolean
}

export interface FindOrCreateResult {
  userId: string
  email: string
  name: string
  isNewUser: boolean
}

// ── Client singleton (lazy init — no module-scope side-effects) ───────────────

let _client: OAuth2Client | null = null

function getOAuthClient(): OAuth2Client {
  if (!_client) {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      throw new Error('GOOGLE_CLIENT_ID environment variable is not set')
    }
    _client = new OAuth2Client(clientId)
  }
  return _client
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Verify a Google ID token and extract the payload.
 * Validates that the token's `aud` matches GOOGLE_CLIENT_ID.
 *
 * @throws Error if the token is invalid or expired
 */
export async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) {
    throw new Error('GOOGLE_CLIENT_ID environment variable is not set')
  }

  const client = getOAuthClient()

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    })
    const payload = ticket.getPayload()
    if (!payload || !payload.sub || !payload.email) {
      throw new Error('Invalid Google token payload')
    }

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      picture: payload.picture,
      emailVerified: payload.email_verified ?? false,
    }
  } catch (err: unknown) {
    logger.error('Google token verification failed', { error: err })
    throw new Error('Invalid or expired Google ID token')
  }
}

/**
 * Find an existing user by googleId or email, or create a new account.
 * Updates the name if it has changed for returning users.
 */
export async function findOrCreateUser(
  payload: GoogleTokenPayload,
): Promise<FindOrCreateResult> {
  // 1. Try find by googleId via Account (next-auth stores OAuth accounts here)
  const existingAccount = await prisma.account.findFirst({
    where: {
      provider: 'google',
      providerAccountId: payload.googleId,
    },
    select: { userId: true, user: { select: { id: true, email: true, name: true } } },
  })

  if (existingAccount?.user) {
    const user = existingAccount.user
    // Update name if changed
    if (user.name !== payload.name) {
      await prisma.user.update({
        where: { id: user.id },
        data: { name: payload.name },
      })
    }
    return { userId: user.id, email: user.email ?? payload.email, name: payload.name, isNewUser: false }
  }

  // 2. Try find by email
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
    select: { id: true, email: true, name: true },
  })

  if (existingUser) {
    // Link the Google account to the existing user
    await prisma.account.create({
      data: {
        userId: existingUser.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: payload.googleId,
      },
    })
    if (existingUser.name !== payload.name) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { name: payload.name },
      })
    }
    return {
      userId: existingUser.id,
      email: existingUser.email ?? payload.email,
      name: payload.name,
      isNewUser: false,
    }
  }

  // 3. Create new user + account
  const newUser = await prisma.user.create({
    data: {
      name: payload.name,
      email: payload.email,
      emailVerified: payload.emailVerified ? new Date() : null,
      image: payload.picture,
      language: 'en',
      role: 'user',
      accounts: {
        create: {
          type: 'oauth',
          provider: 'google',
          providerAccountId: payload.googleId,
        },
      },
    },
    select: { id: true, email: true, name: true },
  })

  logger.info('New user created via Google OAuth', { userId: newUser.id })
  return {
    userId: newUser.id,
    email: newUser.email ?? payload.email,
    name: payload.name,
    isNewUser: true,
  }
}
