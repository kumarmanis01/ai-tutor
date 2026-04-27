import { logger } from '@/lib/logger'

// Ensure logger is closed after all tests to avoid stray async logs
// that may run after Jest finishes and keep the process alive.
afterAll(() => {
  try {
    const maybeClose = (logger as unknown as { close?: (...args: unknown[]) => unknown }).close
    if (typeof maybeClose === 'function') maybeClose.call(logger)
  } catch {
    // swallow — tests should not fail due to teardown cleanup
  }
})
