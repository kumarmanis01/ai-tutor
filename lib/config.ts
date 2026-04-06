/**
 * Central, minimal config helper for runtime feature flags and diagnostic settings.
 * Keeps defaults here for easier testing and overrides via environment variables.
 */
export const diagnosticConfig = {
  minItems: Number(process.env.DIAGNOSTIC_MIN_ITEMS ?? 15),
  maxItems: Number(process.env.DIAGNOSTIC_MAX_ITEMS ?? 25),
  // Minimum valid answers to consider a diagnostic "valid" (not partial/abandoned)
  minAnswersForValidity: Number(process.env.DIAGNOSTIC_MIN_ANSWERS ?? 10),
  // Stopping threshold for posterior standard error (EAP) - configurable for future adaptivity
  seStoppingThreshold: Number(process.env.DIAGNOSTIC_SE_THRESHOLD ?? 0.35),
};

// Feature flags (runtime-configurable via env vars for now)
export const featureFlags = {
  adaptiveDiagnostic: (process.env.FEATURE_ADAPTIVE_DIAGNOSTIC === 'true') || false,
};

export function computeDifficultyCounts(totalItems: number) {
  // Default split: 40% easy, 40% medium, remainder hard
  const easy = Math.max(1, Math.round(totalItems * 0.4));
  const medium = Math.max(1, Math.round(totalItems * 0.4));
  const hard = Math.max(0, totalItems - easy - medium);
  return { totalItems, easy, medium, hard };
}

export default { diagnosticConfig, computeDifficultyCounts };

