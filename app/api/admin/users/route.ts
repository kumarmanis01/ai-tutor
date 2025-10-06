import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/admin/users
// Returns a list of users for the admin panel
export async function GET() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      role: true,
      grade: true,
      parentEmail: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json(users);
}
