/**
 * FILE OBJECTIVE:
 * - Provide Redis-based rate limiting middleware for auth routes to prevent brute force attacks.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/middleware/authRateLimit.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created auth rate limiting middleware
 */

import { NextRequest, NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { logger } from '@/lib/logger';

const CLASS_NAME = 'AuthRateLimit';

/**
 * Rate limit configuration for different auth operations.
 * Each operation has different thresholds based on risk level.
 */
export const AUTH_RATE_LIMITS = {
  // Login attempts - stricter due to credential stuffing risk
  signin: {
    maxRequests: 5,
    windowSeconds: 60 * 15, // 15 minutes
    blockDurationSeconds: 60 * 30, // 30 minutes block after exceeded
  },
  // Signup - moderate limits to prevent spam accounts
  signup: {
    maxRequests: 3,
    windowSeconds: 60 * 60, // 1 hour
    blockDurationSeconds: 60 * 60 * 2, // 2 hours block
  },
  // OTP/code sending - prevent SMS/email abuse
  sendCode: {
    maxRequests: 5,
    windowSeconds: 60 * 15, // 15 minutes
    blockDurationSeconds: 60 * 60, // 1 hour block
  },
  // Password reset - prevent enumeration attacks
  passwordReset: {
    maxRequests: 3,
    windowSeconds: 60 * 60, // 1 hour
    blockDurationSeconds: 60 * 60 * 24, // 24 hours block
  },
} as const;

export type AuthRateLimitOperation = keyof typeof AUTH_RATE_LIMITS;

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  blocked: boolean;
}

/**
 * Get the client identifier for rate limiting.
 * Uses a combination of IP and optional email/phone for more precise limiting.
 */
function getClientIdentifier(req: NextRequest, identifier?: string): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  
  // If we have a user identifier (email/phone), include it for per-user limiting
  if (identifier) {
    // Normalize email/phone to lowercase and remove special chars
    const normalized = identifier.toLowerCase().replace(/[^a-z0-9@.]/g, '');
    return `auth:${ip}:${normalized}`;
  }
  
  return `auth:${ip}`;
}

/**
 * Check rate limit for an auth operation.
 * Returns whether the request is allowed and rate limit metadata.
 */
export async function checkAuthRateLimit(
  req: NextRequest,
  operation: AuthRateLimitOperation,
  identifier?: string
): Promise<RateLimitResult> {
  const config = AUTH_RATE_LIMITS[operation];
  const clientKey = getClientIdentifier(req, identifier);
  const rateLimitKey = `ratelimit:${operation}:${clientKey}`;
  const blockKey = `ratelimit:block:${operation}:${clientKey}`;

  try {
    let redis;
    try {
      redis = getRedis();
    } catch {
      // Redis not available
      redis = null;
    }
    if (!redis) {
      // If Redis is unavailable, allow the request but log warning
      logger.warn('Redis unavailable for rate limiting, allowing request', {
        className: CLASS_NAME,
        methodName: 'checkAuthRateLimit',
        operation,
      });
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
        blocked: false,
      };
    }

    // First check if client is blocked
    const isBlocked = await redis.get(blockKey);
    if (isBlocked) {
      const blockTtl = await redis.ttl(blockKey);
      logger.warn('Rate limit blocked client attempting request', {
        className: CLASS_NAME,
        methodName: 'checkAuthRateLimit',
        operation,
        clientKey,
        remainingBlockSeconds: blockTtl,
      });
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + blockTtl * 1000),
        blocked: true,
      };
    }

    // Increment counter and get current value
    const pipeline = redis.pipeline();
    pipeline.incr(rateLimitKey);
    pipeline.ttl(rateLimitKey);
    
    const results = await pipeline.exec();
    const currentCount = results?.[0]?.[1] as number ?? 1;
    let ttl = results?.[1]?.[1] as number ?? -1;

    // Set expiry on first request
    if (ttl === -1) {
      await redis.expire(rateLimitKey, config.windowSeconds);
      ttl = config.windowSeconds;
    }

    const remaining = Math.max(0, config.maxRequests - currentCount);
    const resetAt = new Date(Date.now() + ttl * 1000);

    if (currentCount > config.maxRequests) {
      // Block the client for extended duration
      await redis.set(blockKey, '1', 'EX', config.blockDurationSeconds);
      
      logger.warn('Auth rate limit exceeded, blocking client', {
        className: CLASS_NAME,
        methodName: 'checkAuthRateLimit',
        operation,
        clientKey,
        currentCount,
        maxRequests: config.maxRequests,
        blockDurationSeconds: config.blockDurationSeconds,
      });

      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(Date.now() + config.blockDurationSeconds * 1000),
        blocked: true,
      };
    }

    return {
      allowed: true,
      remaining,
      resetAt,
      blocked: false,
    };
  } catch (error) {
    // On error, log and allow request (fail-open for availability)
    logger.error('Rate limit check failed', {
      className: CLASS_NAME,
      methodName: 'checkAuthRateLimit',
      operation,
      error: String(error),
    });
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      blocked: false,
    };
  }
}

/**
 * Create a rate-limited response with appropriate headers.
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const response = NextResponse.json(
    {
      error: result.blocked
        ? 'Too many requests. Your access has been temporarily blocked.'
        : 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
    },
    { status: 429 }
  );

  response.headers.set('Retry-After', String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

  return response;
}

/**
 * Middleware wrapper function to apply rate limiting to an auth route.
 * Use this to wrap your route handler.
 * 
 * @example
 * ```typescript
 * import { withAuthRateLimit } from '@/lib/middleware/authRateLimit';
 * 
 * export const POST = withAuthRateLimit('signin', async (req) => {
 *   // Your route logic here
 * });
 * ```
 */
export function withAuthRateLimit(
  operation: AuthRateLimitOperation,
  handler: (req: NextRequest) => Promise<NextResponse>,
  getIdentifier?: (req: NextRequest, body: unknown) => string | undefined
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Clone request to read body without consuming it for the handler
    let identifier: string | undefined;
    
    if (getIdentifier) {
      try {
        const body = await req.clone().json();
        identifier = getIdentifier(req, body);
      } catch {
        // If body parsing fails, use IP-only rate limiting
      }
    }

    const rateLimitResult = await checkAuthRateLimit(req, operation, identifier);

    if (!rateLimitResult.allowed) {
      return createRateLimitResponse(rateLimitResult);
    }

    // Add rate limit headers to successful responses
    const response = await handler(req);
    
    response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetAt.toISOString());

    return response;
  };
}

/**
 * Reset rate limit for a specific client (for admin use or after successful auth).
 */
export async function resetAuthRateLimit(
  operation: AuthRateLimitOperation,
  req: NextRequest,
  identifier?: string
): Promise<void> {
  const clientKey = getClientIdentifier(req, identifier);
  const rateLimitKey = `ratelimit:${operation}:${clientKey}`;
  const blockKey = `ratelimit:block:${operation}:${clientKey}`;

  try {
    const redis = await getRedis();
    if (redis) {
      await redis.del(rateLimitKey, blockKey);
    }
  } catch (error) {
    logger.error('Failed to reset rate limit', {
      className: CLASS_NAME,
      methodName: 'resetAuthRateLimit',
      operation,
      error: String(error),
    });
  }
}
