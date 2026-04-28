/**
 * FILE OBJECTIVE:
 * - Centralized JWT authentication service. Generates and verifies access/refresh
 *   tokens for student users and admin users using jose (JWS/HS256).
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/auth/token.service.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-15T00:00:00Z | copilot | created -- B2.1 JWT token service
 * - 2026-04-27T19:18:00Z | copilot | set admin access-token TTL to 30m for A0.3 session policy
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'crypto';
import { logger } from '@/lib/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TokenPayload {
  /** Subject -- user id */
  sub: string;
  /** Role -- UserRole or AdminRole */
  role: string;
  /** Scope -- 'user' | 'admin' */
  scope: 'user' | 'admin';
  /** JWT ID -- unique per token; used for blacklisting */
  jti: string;
  /** Issued at (epoch seconds) */
  iat: number;
  /** Expires at (epoch seconds) */
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenExpiredError extends Error {
  constructor() {
    super('Token has expired');
    this.name = 'TokenExpiredError';
  }
}

export class TokenInvalidError extends Error {
  constructor(message = 'Token is invalid') {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSecret(envVar: string): Uint8Array {
  const secret = process.env[envVar];
  if (!secret) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
  return new TextEncoder().encode(secret);
}

function chooseSecrets(scope: 'user' | 'admin'): {
  accessSecret: Uint8Array;
  refreshSecret: Uint8Array;
} {
  if (scope === 'admin') {
    return {
      accessSecret: getSecret('ADMIN_JWT_ACCESS_SECRET'),
      refreshSecret: getSecret('ADMIN_JWT_REFRESH_SECRET'),
    };
  }
  return {
    accessSecret: getSecret('JWT_ACCESS_SECRET'),
    refreshSecret: getSecret('JWT_REFRESH_SECRET'),
  };
}

// ── Token generation ──────────────────────────────────────────────────────────

/**
 * Generate a short-lived access token (15 minutes).
 * Uses separate secrets for admin vs user scopes.
 */
export async function generateAccessToken(
  payload: Omit<TokenPayload, 'jti' | 'iat' | 'exp'>
): Promise<string> {
  const { accessSecret } = chooseSecrets(payload.scope);
  const jti = randomUUID();
  const accessTtl = payload.scope === 'admin' ? '30m' : '15m';

  return new SignJWT({ role: payload.role, scope: payload.scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(accessTtl)
    .sign(accessSecret);
}

/**
 * Generate a long-lived refresh token (7 days).
 * Uses separate secrets for admin vs user scopes.
 */
export async function generateRefreshToken(
  payload: Omit<TokenPayload, 'jti' | 'iat' | 'exp'>
): Promise<string> {
  const { refreshSecret } = chooseSecrets(payload.scope);
  const jti = randomUUID();

  return new SignJWT({ role: payload.role, scope: payload.scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(refreshSecret);
}

/**
 * Generate both access and refresh tokens in one call.
 */
export async function generateTokenPair(
  payload: Omit<TokenPayload, 'jti' | 'iat' | 'exp'>
): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);
  return { accessToken, refreshToken };
}

// ── Token verification ────────────────────────────────────────────────────────

/**
 * Verify a JWT and return its payload.
 * Throws TokenExpiredError or TokenInvalidError on failure.
 */
export async function verifyToken(token: string, secret: Uint8Array): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return extractPayload(payload);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('exp')) {
      throw new TokenExpiredError();
    }
    logger.error('JWT verification failed', { error: err });
    throw new TokenInvalidError();
  }
}

/**
 * Verify a user access token.
 */
export async function verifyUserAccessToken(token: string): Promise<TokenPayload> {
  return verifyToken(token, getSecret('JWT_ACCESS_SECRET'));
}

/**
 * Verify a user refresh token.
 */
export async function verifyUserRefreshToken(token: string): Promise<TokenPayload> {
  return verifyToken(token, getSecret('JWT_REFRESH_SECRET'));
}

/**
 * Verify an admin access token.
 */
export async function verifyAdminAccessToken(token: string): Promise<TokenPayload> {
  return verifyToken(token, getSecret('ADMIN_JWT_ACCESS_SECRET'));
}

/**
 * Verify an admin refresh token.
 */
export async function verifyAdminRefreshToken(token: string): Promise<TokenPayload> {
  return verifyToken(token, getSecret('ADMIN_JWT_REFRESH_SECRET'));
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractPayload(raw: JWTPayload): TokenPayload {
  if (!raw.sub || !raw.jti || !raw.iat || !raw.exp) {
    throw new TokenInvalidError('Token payload is missing required fields');
  }
  return {
    sub: raw.sub,
    role: (raw['role'] as string) ?? 'user',
    scope: (raw['scope'] as 'user' | 'admin') ?? 'user',
    jti: raw.jti,
    iat: raw.iat,
    exp: raw.exp,
  };
}
