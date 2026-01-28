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
 * - 2026-01-24T12:00:00Z | copilot | replace ESM createRequire logic with universal PrismaClient singleton to support Jest/CJS
 */

import { PrismaClient } from '@prisma/client';

/* eslint-disable no-var */
declare global {
  // Prevent multiple instances of PrismaClient in development due to HMR
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  var prisma: any | undefined;
}
/* eslint-enable no-var */

const client = global.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') global.prisma = client;

export const prisma = client;

process.on('exit', () => {
  try { void prisma.$disconnect(); } catch {}
});
