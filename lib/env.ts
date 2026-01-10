/**
 * Environment loader.
 *
 * IMPORTANT:
 * - dotenv must NEVER be imported in production builds
 * - Production relies on process.env injected by the platform (PM2, Docker, etc.)
 */
import { createRequire } from 'module'

export function loadEnv() {
  if (process.env.NODE_ENV === 'production') return

  // Try CommonJS `require` first (older tooling / CJS builds)
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    if (typeof (global as any).require === 'function') {
      ;(global as any).require('dotenv').config()
      return
    }
  } catch {}

  // ESM runtime: create a require function from the Node 'module' builtin
  try {
    const req = createRequire(import.meta.url)
    req('dotenv').config()
  } catch {}
}
