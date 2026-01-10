/**
 * Environment loader.
 *
 * IMPORTANT:
 * - dotenv must NEVER be imported in production builds
 * - Production relies on process.env injected by the platform (PM2, Docker, etc.)
 */

export function loadEnv() {
  if (process.env.NODE_ENV !== "production") {
    // Lazy-load dot env ONLY in dev
    // This code is tree-shaken out of prod builds
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require("dotenv").config();
  }
}
