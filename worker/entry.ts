#!/usr/bin/env node
/*
 Minimal worker entrypoint shim.
 - Verify required env vars (`DATABASE_URL`, `REDIS_URL`) on startup.
 - Reuse `validateEnvironment` helper if present (best-effort).
 - If validation passes, import `./bootstrap` to start the worker.
 */

;(async () => {
	const { logger } = await import('@/lib/logger')
	const fatal = (msg: string, err?: any) => {
		try {
			logger.error(`FATAL: ${msg}`)
			if (err) logger.error(String(err))
		} catch {
			// Fall back to stderr if logger fails during startup
			try {
				process.stderr.write(`FATAL: ${msg} ${err ? String(err) : ''}\n`)
			} catch {}
		}
		// exit with non-zero to indicate process should not start
		process.exit(1)
	}

	if (!process.env.DATABASE_URL) {
		fatal('DATABASE_URL is not set')
	}
	if (!process.env.REDIS_URL) {
		fatal('REDIS_URL is not set')
	}

	// If available, reuse the project's environment validator. This may attempt
	// a Prisma connect; that's intentional to catch fatal DB problems early.
	try {
		const mod = await import('@/lib/bootstrap/validateEnvironment')
		const validateEnvironment = (mod && (mod.validateEnvironment || mod.default)) as any
		if (typeof validateEnvironment === 'function') {
			await validateEnvironment({ checkMigrations: false })
		}
	} catch (err) {
		// If the helper import or validation fails, treat it as fatal — worker
		// should not start in a misconfigured environment.
		fatal('validateEnvironment failed', err)
	}

	// All checks passed — start the worker bootstrap.
	await import('./bootstrap')
})()

// Intentionally no exports — this file boots the worker as a side-effect.
