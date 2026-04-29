/**
 * FILE OBJECTIVE:
 * - B6.1: Generate and validate single-use child claim tokens.
 *   Used by the parent "Send to Child" flow (S0.5 / P1.3-P) so a parent-created
 *   child profile can be claimed by the child without registration.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/auth/child-claim-token.service.spec.ts
 *
 * EDIT LOG:
 * - 2026-04-29T00:00:00Z | claude | created for B6.1 / S0.5
 */

import { SignJWT, jwtVerify } from 'jose';
import { randomUUID } from 'crypto';
import { getRedis } from '@/lib/redis';

const CLAIM_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const RATE_LIMIT_WINDOW_SECONDS = 60 * 60; // 1 hour
const RATE_LIMIT_MAX = 5;

// ── Error types ───────────────────────────────────────────────────────────────

export class ClaimTokenExpiredError extends Error {
  constructor() {
    super(
      'This link has expired. Ask your parent to send a new one from their Parent Dashboard.'
    );
    this.name = 'ClaimTokenExpiredError';
  }
}

export class ClaimTokenUsedError extends Error {
  constructor() {
    super(
      'This link has already been used. If you need help, ask your parent to generate a new link.'
    );
    this.name = 'ClaimTokenUsedError';
  }
}

export class ClaimTokenInvalidError extends Error {
  constructor(message = 'Invalid claim token') {
    super(message);
    this.name = 'ClaimTokenInvalidError';
  }
}

export class ClaimTokenRateLimitError extends Error {
  constructor() {
    super('Too many claim links generated recently. Please wait before generating a new one.');
    this.name = 'ClaimTokenRateLimitError';
  }
}

// ── Keys ─────────────────────────────────────────────────────────────────────

function redisStatusKey(jti: string): string {
  return `child_claim:${jti}`;
}

function rateLimitKey(childId: string): string {
  return `child_claim_rl:${childId}`;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('Missing JWT_ACCESS_SECRET');
  return new TextEncoder().encode(secret);
}

// ── Generate ──────────────────────────────────────────────────────────────────

/**
 * Create a signed single-use 7-day claim token for a parent-created child profile.
 * Rate-limited to 5 tokens per childId per hour.
 */
export async function generateChildClaimToken(
  childId: string,
  parentId: string
): Promise<{ claimToken: string; expiresAt: Date }> {
  const redis = getRedis();

  if (redis) {
    const rlKey = rateLimitKey(childId);
    const count = await redis.incr(rlKey);
    if (count === 1) await redis.expire(rlKey, RATE_LIMIT_WINDOW_SECONDS);
    if (count > RATE_LIMIT_MAX) throw new ClaimTokenRateLimitError();
  }

  const jti = randomUUID();
  const expiresAt = new Date(Date.now() + CLAIM_TOKEN_TTL_SECONDS * 1000);

  const claimToken = await new SignJWT({ type: 'child_claim', parentId })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(childId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret());

  // Store single-use status -- GETSET enforces exactly-once consumption
  if (redis) {
    await redis.setex(redisStatusKey(jti), CLAIM_TOKEN_TTL_SECONDS, 'PENDING');
  }

  return { claimToken, expiresAt };
}

// ── Validate & consume ────────────────────────────────────────────────────────

// Lua script: atomically read current status, set to USED, return what was there.
// Returns 'EXPIRED', 'USED', or 'PENDING' (the previous value before marking USED).
const CONSUME_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if current == false then return 'EXPIRED' end
if current ~= 'PENDING' then return current end
redis.call('SET', KEYS[1], 'USED', 'KEEPTTL')
return 'PENDING'
`;

/**
 * Verify the JWT signature/expiry, then atomically consume the single-use Redis
 * status key. Throws a typed error on any failure.
 */
export async function validateAndConsumeChildClaimToken(
  claimToken: string
): Promise<{ childId: string; parentId: string }> {
  // 1. Verify signature + expiry
  let sub: string;
  let parentId: string;
  let jti: string;
  try {
    const { payload } = await jwtVerify(claimToken, getSecret());
    if (
      payload.type !== 'child_claim' ||
      !payload.sub ||
      !payload.jti ||
      typeof payload.parentId !== 'string'
    ) {
      throw new ClaimTokenInvalidError();
    }
    sub = payload.sub;
    parentId = payload.parentId as string;
    jti = payload.jti;
  } catch (err: unknown) {
    if (err instanceof ClaimTokenInvalidError) throw err;
    if (err instanceof Error && /exp|expired/i.test(err.message)) throw new ClaimTokenExpiredError();
    throw new ClaimTokenInvalidError();
  }

  // 2. Atomically consume single-use status in Redis
  const redis = getRedis();
  if (redis) {
    const result = (await redis.eval(
      CONSUME_SCRIPT,
      1,
      redisStatusKey(jti)
    )) as string;

    if (result === 'EXPIRED') throw new ClaimTokenExpiredError();
    if (result !== 'PENDING') throw new ClaimTokenUsedError();
  }

  return { childId: sub, parentId };
}
