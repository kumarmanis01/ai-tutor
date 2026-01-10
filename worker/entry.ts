/* eslint-disable no-console */

/**
 * Worker entrypoint.
 *
 * Responsibilities:
 * - Load environment variables
 * - Fail fast on misconfiguration
 * - Start worker bootstrap
 *
 * This file is the ONLY place where dotenv/env loading happens.
 */

(async () => {
  let logger: any;

  try {
    // Load env FIRST — nothing else should run before this
    const { loadEnv } = await import("../lib/env");
    loadEnv();

    // Logger is loaded AFTER env is available
    ({ logger } = await import("../lib/logger"));

    // Hard guarantees (fail fast)
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
    } catch (err) {
      throw new Error(
        `validateEnvironment failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    // Start worker runtime
    const { bootstrapWorker } = await import("./bootstrap");
    await bootstrapWorker();
  } catch (err) {
    try {
      if (logger) {
        logger.error("[worker] fatal startup error", err);
      } else {
        console.error("[worker] fatal startup error", err);
      }
    } catch {
      // absolute last-resort logging
      try {
        process.stderr.write(
          `[worker] fatal startup error: ${String(err)}\n`
        );
      } catch {}
    }

    process.exit(1);
  }
})();
