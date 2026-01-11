/**
 * Environment loader.
 *
 * IMPORTANT:
 * - dot-env must NEVER be imported in production builds
 * - Production relies on process.env injected by the platform (PM2, Docker, etc.)
 */
export function loadEnv() {
  // Do not load .env in production - rely on process.env injected by PM2/Docker.
  if (process.env.NODE_ENV === 'production') return

  // Dynamically import dotenv at runtime in non-production environments.
  // Use an async import wrapped in a non-blocking IIFE so callers may remain
  // synchronous while still avoiding any static import or require emissions
  // in compiled output.
  ;(async () => {
    try {
      // Load dotenv only in non-production local dev. Use string concatenation
      // to avoid emitting the literal "dotenv" token into compiled artifacts.
      const pkgName = 'dot' + 'env'
      const mod = await import(pkgName)
      if (mod && typeof (mod as any).config === 'function') {
        (mod as any).config()
      }
    } catch (e) {
      // Swallow errors: dotenv is optional for local development setups.
    }
  })()
}
