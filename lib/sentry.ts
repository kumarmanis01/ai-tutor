/**
 * FILE OBJECTIVE:
 * - Sentry error tracking utilities for consistent error reporting across the application.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/sentry.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-XX | copilot | created Sentry helper utilities
 */

import * as Sentry from '@sentry/nextjs';
import { logger } from '@/lib/logger';

const CLASS_NAME = 'sentry';

/**
 * Severity levels for error categorization
 */
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info' | 'debug';

/**
 * Context for error tracking
 */
export interface ErrorContext {
  /** User ID if available */
  userId?: string;
  /** User email if available and allowed */
  userEmail?: string;
  /** Component or service name */
  component?: string;
  /** Operation being performed */
  operation?: string;
  /** Additional tags for filtering */
  tags?: Record<string, string>;
  /** Extra data for debugging */
  extra?: Record<string, unknown>;
  /** Severity level */
  severity?: ErrorSeverity;
}

/**
 * Capture an exception with context
 */
export function captureException(error: unknown, context?: ErrorContext): string | undefined {
  // Only capture in production with Sentry configured
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    logger.error('[Sentry disabled] Error captured', { className: CLASS_NAME, error: String(error), context });
    return undefined;
  }

  return Sentry.captureException(error, {
    level: context?.severity || 'error',
    user: context?.userId
      ? {
          id: context.userId,
          email: context.userEmail,
        }
      : undefined,
    tags: {
      component: context?.component,
      operation: context?.operation,
      ...context?.tags,
    },
    extra: context?.extra,
  });
}

/**
 * Capture a message (for non-exception events)
 */
export function captureMessage(
  message: string,
  level: ErrorSeverity = 'info',
  context?: Omit<ErrorContext, 'severity'>
): string | undefined {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    logger.debug(`[Sentry disabled] ${level}: ${message}`, { className: CLASS_NAME, context });
    return undefined;
  }

  return Sentry.captureMessage(message, {
    level,
    user: context?.userId
      ? {
          id: context.userId,
          email: context.userEmail,
        }
      : undefined,
    tags: {
      component: context?.component,
      operation: context?.operation,
      ...context?.tags,
    },
    extra: context?.extra,
  });
}

/**
 * Set user context for subsequent events
 */
export function setUser(user: { id: string; email?: string; name?: string } | null): void {
  if (process.env.NODE_ENV !== 'production') return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
      username: user.name,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: ErrorSeverity = 'info'
): void {
  if (process.env.NODE_ENV !== 'production') return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Start a performance transaction/span
 */
export function startTransaction(
  name: string,
  op: string,
  data?: Record<string, unknown>
): any {
  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return undefined;
  }

  return Sentry.startInactiveSpan({
    name,
    op,
    attributes: data as Record<string, string | number | boolean>,
  });
}

/**
 * Wrap an async function with error tracking
 */
export function withSentry<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: ErrorContext
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return (await fn(...args)) as ReturnType<T>;
    } catch (error) {
      captureException(error, context);
      throw error;
    }
  }) as T;
}

/**
 * API route error handler
 */
export function handleApiError(
  error: unknown,
  context: { route: string; method: string; userId?: string }
): void {
  captureException(error, {
    component: 'api',
    operation: `${context.method} ${context.route}`,
    userId: context.userId,
    tags: {
      route: context.route,
      method: context.method,
    },
    severity: 'error',
  });
}

/**
 * Worker/Job error handler
 */
export function handleWorkerError(
  error: unknown,
  context: { jobType: string; jobId?: string; workerId?: string }
): void {
  captureException(error, {
    component: 'worker',
    operation: context.jobType,
    tags: {
      jobType: context.jobType,
      jobId: context.jobId || 'unknown',
      workerId: context.workerId || 'unknown',
    },
    severity: 'error',
  });
}

/**
 * Payment/billing error handler (high severity)
 */
export function handlePaymentError(
  error: unknown,
  context: { userId: string; operation: string; amount?: number; provider?: string }
): void {
  captureException(error, {
    userId: context.userId,
    component: 'billing',
    operation: context.operation,
    severity: 'fatal', // Payment errors are critical
    tags: {
      provider: context.provider || 'unknown',
    },
    extra: {
      amount: context.amount,
    },
  });
}
