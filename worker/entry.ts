#!/usr/bin/env node
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Worker entrypoint (production-friendly)
 * - MUST NOT load dotenv or any env-file loader here.
 * - Use relative imports only (no @/ aliases).
 * - Fail fast if required env vars are missing.
 */

// Avoid top-level ESM imports so compiled output is less likely to be forced
// into a CommonJS wrapper when built. Use dynamic imports at runtime.

(async () => {
  try {
    // Hard fail if env is missing — DO NOT load dotenv here
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set");
    }
    if (!process.env.REDIS_URL) {
      throw new Error("REDIS_URL is not set");
    }

    // Optional deep validation (best-effort, but fatal if present and fails)
    try {
      const mod = await import("../lib/bootstrap/validateEnvironment");
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
    const { bootstrapWorker } = await import("./bootstrap");
    await bootstrapWorker();
  } catch (err) {
    // Use dynamic import for logger so we avoid top-level import emissions.
    try {
      const mod = await import("../lib/logger").catch(() => ({}));
      const logger = (mod as any)?.logger ?? (mod as any)?.default ?? null;
      if (logger && typeof logger.error === 'function') {
        logger.error("[worker] fatal startup error", err);
      } else {
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
