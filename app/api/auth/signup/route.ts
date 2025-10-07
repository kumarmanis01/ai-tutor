import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import type { SessionUser } from '@/lib/types';

type SignupBody = Pick<SessionUser, 'name' | 'email' | 'parentEmail' | 'grade'> & {
  profileImage?: string;
  password?: string;
  country?: string;
};

export async function POST(req: NextRequest) {
  const { name, email, parentEmail, profileImage, grade, password, country }: SignupBody =
    await req.json();

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'User exists' }, { status: 409 });
  }

  // Hash the password if provided
  let passwordHash: string | undefined = undefined;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  // Create user
  await prisma.user.create({
    data: {
      name,
      email,
      parentEmail: parentEmail || null,
      image: profileImage || null,
      grade: grade || null,
      passwordHash: passwordHash || null,
      country: country || null, // <-- Add country
    },
  });

  return NextResponse.json({ ok: true });
}
