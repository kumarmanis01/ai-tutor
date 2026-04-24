/**
 * FILE OBJECTIVE:
 * - POST /api/v1/auth/google -- validates a Google ID token and returns
 *   a JWT token pair. Rate-limited to 10 requests per IP per minute.
 *
 * LINKED UNIT TEST:
 * - tests/unit/app/api/v1/auth/google/route.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B2.2 Google OAuth API route
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyGoogleToken, findOrCreateUser } from '@/lib/auth/google.service'
import { generateTokenPair } from '@/lib/auth/token.service'
import { getRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

// ── Rate limit helpers ────────────────────────────────────────────────────────

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_SECONDS = 60

async function checkRateLimit(ip: string): Promise<boolean> {
  const redis = getRedis()
  const key = `ratelimit:google:auth:${ip}`
  const count = await redis.incr(key)
  if (count === 1) {
    // First request in window -- set expiry
    await redis.expire(key, RATE_LIMIT_WINDOW_SECONDS)
  }
  return count <= RATE_LIMIT_MAX
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req)

  // Rate limit check
  try {
    const allowed = await checkRateLimit(ip)
    if (!allowed) {
      return NextResponse.json(
        { code: 'RATE_LIMITED', message: 'Too many requests. Try again in a minute.' },
        { status: 429 },
      )
    }
  } catch (err: unknown) {
    // Redis failure: allow the request through -- do not block auth on infra error
    logger.error('Rate limit check failed', { ip, error: err })
  }

  // Parse body
  let idToken: string
  try {
    const body = (await req.json()) as { idToken?: unknown }
    if (typeof body.idToken !== 'string' || !body.idToken) {
      return NextResponse.json(
        { code: 'INVALID_REQUEST', message: 'idToken is required' },
        { status: 400 },
      )
    }
    idToken = body.idToken
  } catch {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'Invalid JSON body' },
      { status: 400 },
    )
  }

  // Verify Google token
  let googlePayload
  try {
    googlePayload = await verifyGoogleToken(idToken)
  } catch {
    return NextResponse.json(
      { code: 'INVALID_TOKEN', message: 'Invalid or expired Google ID token' },
      { status: 401 },
    )
  }

  // Find or create user
  let result
  try {
    result = await findOrCreateUser(googlePayload)
  } catch (err: unknown) {
    logger.error('findOrCreateUser failed', { error: err })
    return NextResponse.json(
      { code: 'SERVER_ERROR', message: 'Authentication failed. Please try again.' },
      { status: 500 },
    )
  }

  // Generate token pair
  let tokens
  try {
    tokens = await generateTokenPair({
      sub: result.userId,
      role: 'user',
      scope: 'user',
    })
  } catch (err: unknown) {
    logger.error('Token generation failed', { error: err })
    return NextResponse.json(
      { code: 'SERVER_ERROR', message: 'Authentication failed. Please try again.' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isNewUser: result.isNewUser,
  })
}
