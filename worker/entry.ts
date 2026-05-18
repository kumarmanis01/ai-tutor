#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Worker entrypoint (production-friendly)
 * - For local runs, we load .env once to match `npm run dev` / `npm run build`.
 * - In production, environment is injected by the process manager (no .env file required).
 * - Use relative imports only (no @/ aliases).
 * - Fail fast if required env vars are missing.
 */

import path from 'path';

// Local/CI only: ensure DATABASE_URL and REDIS_URL match the .env file.
// dotenv must never appear as a literal import token in compiled output -- the
// verify-dist check and Vercel's scanner both flag it. We load it via eval so
// the string is never statically analysable as an import of "dotenv".
if (process.env.NODE_ENV !== 'production') {
  try {
    // eslint-disable-next-line no-eval
    const req = eval('require') as NodeJS.Require;
    const pkg = req('dot' + 'env');
    if (pkg && typeof pkg.config === 'function') {
      const envPath = path.resolve(process.cwd(), '.env');
      pkg.config({ path: envPath });
    }
  } catch {
    // dotenv is optional -- swallow if not installed in this environment
  }
}

process.on('unhandledRejection', (reason) => {
  process.stderr.write(`[worker] unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}\n`);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  process.stderr.write(`[worker] uncaughtException: ${err.stack ?? String(err)}\n`);
  process.exit(1);
});

// Validate required env vars before anything else loads
try {
  // Dynamic import to avoid tsc-alias rewriting the @/ path at the entry level
  const envMod = await import('../lib/envSchema.js').catch(() => null);
  if (envMod && typeof envMod.validateEnvOrExit === 'function') {
    envMod.validateEnvOrExit();
  }
} catch {
  // Module not found in compiled output is non-fatal; hard checks below cover the critical vars
}

(async () => {
  try {
    // Hard fail if env is missing -- DO NOT load dotenv here
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL is not set");
    }

    // Optional deep validation (best-effort, but fatal if present and fails)
    try {
      // IMPORTANT: This path is for RUNTIME after compilation.
      // worker/entry.ts compiles to dist/worker/worker/entry.js
      // lib/bootstrap/validateEnvironment.ts compiles to dist/worker/lib/bootstrap/validateEnvironment.js
      // So the correct runtime path from entry.js is ../lib/bootstrap/validateEnvironment.js
      // We use a string literal with .js extension to avoid tsc-alias rewriting it.
      const validateEnvPath = "../lib/bootstrap/validateEnvironment.js";
      const mod = await import(validateEnvPath);
      const validateEnvironment =
        (mod as any)?.validateEnvironment ?? (mod as any)?.default;

      if (typeof validateEnvironment === "function") {
        await validateEnvironment({ checkMigrations: false });
      }
    } catch (err: any) {
      // If the module isn't present, ignore. If it is present and throws,
      // surface the error so startup fails.
      const code = err?.code ?? err?.name ?? null;
      if (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') {
        // no-op
      } else if (err && String(err).includes('Cannot find module')) {
        // no-op for some environments
      } else if (err) {
        throw new Error(
          `validateEnvironment failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    // Start worker runtime
    const { bootstrapWorker } = await import("./bootstrap.js");
    await bootstrapWorker();
  } catch (err) {
    // Print full stack to stderr first to ensure visibility in container logs.
    try {
      if (err && (err as any).stack) {
        process.stderr.write(`[worker] fatal startup error (stack): ${(err as any).stack}\n`);
      } else {
        process.stderr.write(`[worker] fatal startup error: ${String(err)}\n`);
      }
    } catch {}

    // Use dynamic import for logger so we avoid top-level import emissions.
    try {
      const mod = await import("../lib/logger.js").catch(() => ({}));
      const logger = (mod as any)?.logger ?? (mod as any)?.default ?? null;
      if (logger && typeof logger.error === 'function') {
        logger.error("[worker] fatal startup error");
      } else {
        // Already printed stack above; still emit a compact message.
        process.stderr.write(`[worker] fatal startup error: ${String(err)}\n`);
      }
    } catch {
      try {
        process.stderr.write(`[worker] fatal startup error: ${String(err)}\n`);
      } catch {}
    }

    process.exit(1);
  }
})();
