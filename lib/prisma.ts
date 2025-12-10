
import { PrismaClient } from '@prisma/client';

declare global {
  // Avoid multiple instances of PrismaClient in development
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: ['query', 'info', 'warn', 'error'], // optional: useful during dev
  });

// In dev, store Prisma client globally so it's not re-created on hot reload
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
