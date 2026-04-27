/**
 * FILE OBJECTIVE:
 * - Error handling standards for Student Dashboard APIs.
 * - Consistent error response formatting.
 * - Error code mapping and messages.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/api/student/errors.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2026-02-04 | claude | created error handling utilities
 */

import type { ApiError, ApiResponse, ResponseMeta } from './schemas';
import { ERROR_CODES, type ErrorCode } from './schemas';

// ============================================================================
// ERROR CLASSES
// ============================================================================

/**
 * Base API error class
 */
export class ApiException extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Authentication error (401)
 */
export class AuthenticationError extends ApiException {
  constructor(message: string = 'Authentication required') {
    super(ERROR_CODES.AUTH_REQUIRED, message, 401);
  }
}

/**
 * Authorization error (403)
 */
export class AuthorizationError extends ApiException {
  constructor(message: string = 'Access forbidden') {
    super(ERROR_CODES.FORBIDDEN, message, 403);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends ApiException {
  constructor(resource: string) {
    super(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404, { resource });
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends ApiException {
  constructor(errors: Record<string, string>) {
    super(
      ERROR_CODES.VALIDATION_ERROR,
      'Validation failed',
      400,
      { errors }
    );
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends ApiException {
  constructor(retryAfter: number) {
    super(
      ERROR_CODES.RATE_LIMITED,
      'Too many requests',
      429,
      { retryAfter }
    );
  }
}

/**
 * Subscription required error (402)
 */
export class SubscriptionRequiredError extends ApiException {
  constructor(requiredPlan: string) {
    super(
      ERROR_CODES.SUBSCRIPTION_REQUIRED,
      `Subscription required: ${requiredPlan}`,
      402,
      { requiredPlan }
    );
  }
}

// ============================================================================
// ERROR RESPONSE BUILDER
// ============================================================================

/**
 * HTTP status codes for error codes
 */
const STATUS_CODE_MAP: Record<ErrorCode, number> = {
  [ERROR_CODES.AUTH_REQUIRED]: 401,
  [ERROR_CODES.AUTH_INVALID]: 401,
  [ERROR_CODES.AUTH_EXPIRED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.SUBSCRIPTION_REQUIRED]: 402,
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_INPUT]: 400,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.ALREADY_EXISTS]: 409,
  [ERROR_CODES.RATE_LIMITED]: 429,
  [ERROR_CODES.QUOTA_EXCEEDED]: 429,
  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.SESSION_EXPIRED]: 410,
  [ERROR_CODES.SESSION_COMPLETED]: 410,
  [ERROR_CODES.NO_QUESTIONS_AVAILABLE]: 404,
};

/**
 * Default error messages
 */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  [ERROR_CODES.AUTH_REQUIRED]: 'Authentication is required',
  [ERROR_CODES.AUTH_INVALID]: 'Invalid authentication credentials',
  [ERROR_CODES.AUTH_EXPIRED]: 'Authentication has expired',
  [ERROR_CODES.FORBIDDEN]: 'You do not have permission to access this resource',
  [ERROR_CODES.SUBSCRIPTION_REQUIRED]: 'A subscription is required for this feature',
  [ERROR_CODES.VALIDATION_ERROR]: 'The request contains invalid data',
  [ERROR_CODES.INVALID_INPUT]: 'Invalid input provided',
  [ERROR_CODES.NOT_FOUND]: 'The requested resource was not found',
  [ERROR_CODES.ALREADY_EXISTS]: 'The resource already exists',
  [ERROR_CODES.RATE_LIMITED]: 'Too many requests. Please try again later',
  [ERROR_CODES.QUOTA_EXCEEDED]: 'Your usage quota has been exceeded',
  [ERROR_CODES.INTERNAL_ERROR]: 'An unexpected error occurred',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable',
  [ERROR_CODES.SESSION_EXPIRED]: 'The session has expired',
  [ERROR_CODES.SESSION_COMPLETED]: 'The session has already been completed',
  [ERROR_CODES.NO_QUESTIONS_AVAILABLE]: 'No questions are available for this topic',
};

/**
 * Build error response
 */
export function buildErrorResponse<T>(
  code: ErrorCode,
  message?: string,
  details?: Record<string, unknown>,
  requestId?: string
): ApiResponse<T> {
  const error: ApiError = {
    code,
    message: message || DEFAULT_MESSAGES[code],
    details,
  };

  const meta: ResponseMeta = {
    requestId: requestId || generateRequestId(),
    version: 'v1',
    timestamp: new Date().toISOString(),
  };

  return {
    success: false,
    data: null,
    error,
    meta,
  };
}

/**
 * Build success response
 */
export function buildSuccessResponse<T>(
  data: T,
  requestId?: string,
  cache?: { ttl: number; etag?: string }
): ApiResponse<T> {
  const meta: ResponseMeta = {
    requestId: requestId || generateRequestId(),
    version: 'v1',
    timestamp: new Date().toISOString(),
    cache: cache ? {
      ttl: cache.ttl,
      etag: cache.etag,
      cacheable: cache.ttl > 0,
    } : undefined,
  };

  return {
    success: true,
    data,
    error: null,
    meta,
  };
}

/**
 * Get HTTP status code for error code
 */
export function getStatusCode(code: ErrorCode): number {
  return STATUS_CODE_MAP[code] || 500;
}

/**
 * Handle and format error for response
 */
export function handleError<T>(
  error: unknown,
  requestId?: string
): { response: ApiResponse<T>; statusCode: number } {
  if (error instanceof ApiException) {
    return {
      response: buildErrorResponse<T>(
        error.code,
        error.message,
        error.details,
        requestId
      ),
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    // Log the actual error internally (console.error removed for production)
    // TODO: Use proper logging service (Sentry, Winston, etc.)

    return {
      response: buildErrorResponse<T>(
        ERROR_CODES.INTERNAL_ERROR,
        'An unexpected error occurred',
        undefined,
        requestId
      ),
      statusCode: 500,
    };
  }

  return {
    response: buildErrorResponse<T>(
      ERROR_CODES.INTERNAL_ERROR,
      'An unexpected error occurred',
      undefined,
      requestId
    ),
    statusCode: 500,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate a request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if error is a specific type
 */
export function isApiError(error: unknown, code: ErrorCode): boolean {
  return error instanceof ApiException && error.code === code;
}

/**
 * Extract error code from response
 */
export function getErrorCode<T>(response: ApiResponse<T>): ErrorCode | null {
  return response.error?.code as ErrorCode || null;
}
