import { z } from 'zod';

const boolEnv = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const intEnv = (defaultVal: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v !== undefined && v !== '' ? Number(v) : defaultVal))
    .pipe(z.number().int().nonnegative());

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  // Auth
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url().optional(),

  // AI providers
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Email
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  ONCALL_EMAIL: z.string().optional(),

  // LLM feature flags
  LLM_MODE: z.enum(['real', 'mock']).default('real'),
  LLM_SAFE_MODE: boolEnv.default('true' as never),
  ENABLE_AI_TUTOR: boolEnv.default('false' as never),
  ENABLE_DISTRESS_DETECTION: boolEnv.default('false' as never),
  QUESTIONS_PARALLEL: boolEnv.default('false' as never),

  // Numeric tunables
  DB_POOL_SIZE: intEnv(5),
  ROLLOUT_PERCENTAGE: intEnv(5),
  AI_CONTENT_LOG_RETENTION_DAYS: intEnv(30),
  RECONCILER_TOPICS_PER_SUBJECT_CAP: intEnv(0),

  // Monitoring
  SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_CONSENT_LIVE: boolEnv.default('false' as never),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
  NEXT_PUBLIC_RAZORPAY_KEY_ID: z.string().optional(),
  NEXT_PUBLIC_HINDI_ENABLED: boolEnv.default('false' as never),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

let _validated: ServerEnv | null = null;

export function getValidatedEnv(): ServerEnv {
  if (_validated) return _validated;
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  _validated = result.data;
  return _validated;
}

export function validateEnvOrExit(): void {
  try {
    getValidatedEnv();
  } catch (err) {
    process.stderr.write(`[env] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  }
}
