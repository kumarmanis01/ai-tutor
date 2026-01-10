/**
 * Worker environment checks.
 * - This file MUST NOT import or call `dotenv`.
 * - Keep checks lightweight and deterministic for plain Node runtime.
 */

export function loadEnv() {
  // For worker runtime we do not load .env files. This helper performs
  // minimal validation to catch obvious misconfiguration early.
  const missing: string[] = []
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL')
  if (!process.env.REDIS_URL) missing.push('REDIS_URL')

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // No-op otherwise — supervisor is responsible for injecting env.
}

export default loadEnv
