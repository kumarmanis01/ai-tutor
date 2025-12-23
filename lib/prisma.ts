
import { PrismaClient } from '@prisma/client';

declare global {
  // Avoid multiple instances of PrismaClient in development
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    // Avoid noisy Prisma logs during `test` runs which can trigger Jest warnings
    log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error'],
  });

// In dev, store Prisma client globally so it's not re-created on hot reload
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Ensure Prisma disconnects when the process is exiting to avoid "Cannot log after tests are done" warnings
process.on('exit', () => {
  try {
    // best-effort disconnect
    void prisma.$disconnect()
  } catch {
    // swallow
  }
});
