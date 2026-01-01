import { logger } from '../../lib/logger'

// Ensure logger is closed after all tests to avoid stray async logs
// that may run after Jest finishes and keep the process alive.
afterAll(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (logger as any).close === 'function') (logger as any).close()
  } catch {
    // swallow — tests should not fail due to teardown cleanup
  }
})
