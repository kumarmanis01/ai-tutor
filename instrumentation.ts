import * as Sentry from "@sentry/nextjs";
import { getValidatedEnv } from "@/lib/envSchema";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validate required server env vars at startup; throws with a clear message if any are missing
    try {
      getValidatedEnv();
    } catch (err) {
      // Log clearly but don't crash the process -- Next.js may recover other routes
      console.error("[env]", err instanceof Error ? err.message : String(err));
    }
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
