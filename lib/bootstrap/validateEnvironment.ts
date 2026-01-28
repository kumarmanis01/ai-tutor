import { prisma } from '../prisma'

export type ValidateOptions = { checkMigrations?: boolean }

/**
 * Validate runtime environment for the app.
 * - ensures `DATABASE_URL` exists
 * - verifies Prisma can connect
 * - optionally checks for pending migrations (best-effort)
 *
 * Throws an Error on fatal validation failures.
 */
export async function validateEnvironment(opts: ValidateOptions = { checkMigrations: false }) {
  if (!process.env.DATABASE_URL) {
    throw new Error('Environment validation failed: DATABASE_URL is not set')
  }

  // Verify Prisma can connect
  try {
    // use $connect to ensure network/connectivity issues surface
    await prisma.$connect()
  } catch (err: any) {
    throw new Error(`Environment validation failed: Prisma could not connect: ${String(err?.message ?? err)}`)
  }

  if (opts.checkMigrations) {
    try {
      // _prisma_migrations table is created by Prisma Migrate; query is best-effort
      const res: any = await (prisma as any).$queryRawUnsafe(`SELECT count(*) AS cnt FROM _prisma_migrations WHERE finished_at IS NULL`)
      let cnt = 0
      if (Array.isArray(res) && res.length > 0) cnt = Number(res[0]?.cnt ?? res[0]?.count ?? 0)
      else cnt = Number(res?.cnt ?? res?.count ?? 0)
      if (cnt > 0) throw new Error(`Environment validation failed: ${cnt} pending migrations detected in _prisma_migrations`) 
    } catch (err: any) {
      // If the migrations table does not exist or query fails, surface the error
      throw new Error(`Environment validation failed during migration check: ${String(err?.message ?? err)}`)
    }
  }

  return true
}

export default validateEnvironment
