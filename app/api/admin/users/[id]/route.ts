import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// @ts-expect-error Ignore type checking for params in this handler
export async function PATCH(req, { params }) {
  const data = await req.json();
  const user = await prisma.user.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(user);
}
