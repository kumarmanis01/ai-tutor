
/* eslint-disable @typescript-eslint/no-require-imports */
/*
 * Create a Prisma client if available. Use dynamic require so that
 * production builds which do not have a generated `@prisma/client` at
 * compile-time (for some CI/VPS workflows) do not hard-fail TS compilation.
 */
let PrismaClient: any = undefined
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkg = require('@prisma/client')
  PrismaClient = pkg && pkg.PrismaClient ? pkg.PrismaClient : pkg?.default?.PrismaClient
} catch {
  PrismaClient = undefined
}

/* eslint-disable no-var */
declare global {
  // Keep a global reference in dev to avoid multiple clients on HMR
  // Use `any` to avoid type dependency on `@prisma/client` types.
  var prisma: any | undefined;
}
/* eslint-enable no-var */

export const prisma =
  global.prisma ||
  (PrismaClient ? new PrismaClient({ log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error'] }) : ({} as any));

if (process.env.NODE_ENV !== 'production' && PrismaClient) {
  global.prisma = prisma;
}

if (PrismaClient) {
  process.on('exit', () => {
    try { void prisma.$disconnect() } catch {}
  });
}
