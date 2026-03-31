import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/admin/syllabi
 * Returns an array of persisted syllabi ordered by createdAt desc.
 */
export async function GET() {
  try {
    const rows = await prisma.syllabus.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json([]);
  }
}
