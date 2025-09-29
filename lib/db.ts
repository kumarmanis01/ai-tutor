// lib/db.ts
// Prisma client singleton to avoid multiple instances during dev/hot-reload
import { PrismaClient } from '@prisma/client';

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  });

if (process.env.NODE_ENV === 'development') global.__prisma = prisma;

export default prisma;
