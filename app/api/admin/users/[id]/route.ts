import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PATCH /api/admin/users/[id]
// Updates user status, role, or other fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { status, role, name, grade, parentEmail } = await req.json();
  const user = await prisma.user.update({
    where: { id: params.id },
    data: { status, role, name, grade, parentEmail },
  });

  // Audit log for admin action
  await prisma.auditLog.create({
    data: {
      userId: params.id,
      action: 'admin_update_user',
      details: { status, role, name, grade, parentEmail },
    },
  });

  return NextResponse.json(user);
}
