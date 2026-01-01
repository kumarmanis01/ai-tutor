import { NextResponse } from 'next/server';

/**
 * GET /api/admin/syllabi
 * Returns an array of persisted syllabi ordered by createdAt desc.
 * If Prisma is not available or DB access fails, returns an empty array.
 */
export async function GET() {
  try {
    // Dynamically import Prisma client if available
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    const rows = await prisma.syllabus.findMany({ orderBy: { createdAt: 'desc' } });
    await prisma.$disconnect();
    return NextResponse.json(rows);
  } catch {
    // If Prisma isn't installed or DB not reachable, return empty list
    return NextResponse.json([]);
  }
}
