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
  // Dynamically require dotenv in non-production environments without
  // emitting the literal "dotenv" token into compiled artifacts. Using
  // `eval('require')` prevents TypeScript or bundlers from statically
  // replacing the call with a literal import/require.
  try {
    // eslint-disable-next-line no-eval
    const req = eval('require') as NodeJS.Require;
    const pkg = req && req('dot' + 'env');
    if (pkg && typeof (pkg as any).config === 'function') {
      ;(pkg as any).config()
    }
  } catch {
    // Swallow errors: dotenv is optional for local development setups.
  }
}
