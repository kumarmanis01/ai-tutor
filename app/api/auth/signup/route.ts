import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcrypt';
import type { SessionUser } from '@/lib/types';

type SignupBody = Pick<SessionUser, 'name' | 'email' | 'parentEmail' | 'grade'> & {
  profileImage?: string;
  password?: string;
};

export async function POST(req: NextRequest) {
  const { name, email, parentEmail, profileImage, grade, password }: SignupBody = await req.json();

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'User exists' }, { status: 409 });
  }

  // Hash the password if provided
  let passwordHash: string | undefined = undefined;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10); // 10 salt rounds
  }

  // Create user
  await prisma.user.create({
    data: {
      name,
      email,
      parentEmail: parentEmail || null,
      image: profileImage || null,
      grade: grade || null,
      passwordHash: passwordHash || null, // Store the hash, not the plain password
    },
  });

  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'signup',
        details: {
          email: user.email,
          name: user.name,
          grade: user.grade,
          parentEmail: user.parentEmail,
        },
      },
    });
  } catch (err) {
    console.error('Audit log failed:', err);
  }

  return NextResponse.json({ ok: true });
}
