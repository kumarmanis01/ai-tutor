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
