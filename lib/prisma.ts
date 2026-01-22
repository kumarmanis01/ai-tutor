/**
 * FILE OBJECTIVE:
 * - Provide a singleton PrismaClient for the application, with fallback stub for safer errors.
 *
 * LINKED UNIT TEST:
 * - tests/unit/lib/prisma.spec.ts
 *
 * COPILOT INSTRUCTIONS FOLLOWED:
 * - /docs/COPILOT_GUARDRAILS.md
 * - .github/copilot-instructions.md
 *
 * EDIT LOG:
 * - 2025-01-21T16:10:00Z | copilot | removed unused fileURLToPath import to fix lint warning
 * - 2025-01-02T00:00:00Z | copilot | fixed ESM import for @prisma/client using createRequire
 */

import { createRequire } from 'module';

/*
 * Create a Prisma client if available. Use createRequire to support ESM builds
 * (package.json has "type": "module") where bare require() is unavailable.
 */
let PrismaClient: any = undefined;
try {
  // In ESM context, require() is not available. Use createRequire to load CJS modules.
  const esmRequire = createRequire(import.meta.url);
  const pkg = esmRequire('@prisma/client');
  PrismaClient = pkg && pkg.PrismaClient ? pkg.PrismaClient : pkg?.default?.PrismaClient;
} catch {
  PrismaClient = undefined;
}

/* eslint-disable no-var */
declare global {
  // Keep a global reference in dev to avoid multiple clients on HMR
  // Use `any` to avoid type dependency on `@prisma/client` types.
  var prisma: any | undefined;
}
/* eslint-enable no-var */

function createPrismaClient() {
  if (!PrismaClient) {
    // Return a stub that throws on any method call so errors are explicit
    return new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') return undefined; // not a thenable
        return () => {
          throw new Error(`PrismaClient is not available. Ensure @prisma/client is installed and prisma generate has run. Attempted to call: ${String(prop)}`);
        };
      }
    });
  }
  return new PrismaClient({
    log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error']
  });
}

export const prisma = global.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production' && PrismaClient) {
  global.prisma = prisma;
}

if (PrismaClient) {
  process.on('exit', () => {
    try { void prisma.$disconnect() } catch {}
  });
}
